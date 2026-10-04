'use strict';
const { Router } = require('express');
const axios      = require('axios');
const FormData   = require('form-data');
const multer     = require('multer');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

function _handleUpload(upload_middleware) {
  return function(req, res, next) {
    upload_middleware(req, res, function(err) {
      if (!err) return next();
      const { sendErrorResponse } = require('../../../config/apikeyConfig');
      const multer = require('multer');
      if (err instanceof multer.MulterError) {
        return sendErrorResponse(res, err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file terlalu besar. Maksimum 20MB.' : 'Upload error: ' + err.message, 400);
      }
      return sendErrorResponse(res, err.message || 'Upload gagal.', 400);
    });
  };
}

const _audioFilter = (req, file, cb) => {
  const allowed = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/m4a', 'video/mp4'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Tipe file tidak diizinkan. Gunakan: MP3, WAV, OGG, atau WEBM.'), false);
};
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: _audioFilter });

async function transcribe(buf, filename) {
    const { data: cf } = await axios.post('https://rynekoo-cf.hf.space/action', {
        url:'https://aidictation.com/tools/transcribe', siteKey:'0x4AAAAAACgbDnY2xQyOrOfk', mode:'turnstile-min'
    });
    if (!cf?.data?.token) throw new Error('Gagal mendapatkan CF token.');
    const form = new FormData();
    form.append('file', buf, filename);
    form.append('turnstile_token', cf.data.token);
    const { data } = await axios.post('https://aidictation.com/api/transcribe', form, {
        headers:{...form.getHeaders(), origin:'https://aidictation.com', referer:'https://aidictation.com/tools/transcribe'}
    });
    return data;
}

router.get('/api/ai/aidictation', asyncHandler(async (req, res) => {
    const { url } = req.query;
    if (!url) throw new ValidationError('Parameter "url" wajib diisi untuk GET request.');
    if (!validate.url(url)) throw new ValidationError('Parameter "url" tidak valid.');
    const resp = await axios.get(url, { responseType:'arraybuffer', timeout:60000 });
    sendSuccessResponse(res, await transcribe(Buffer.from(resp.data), `audio_${Date.now()}.mp3`));
}));

router.post('/api/ai/aidictation', _handleUpload(upload.single('file')), asyncHandler(async (req, res) => {
    if (req.file?.buffer) {

        return sendSuccessResponse(res, await transcribe(req.file.buffer, `${Date.now()}_audio.mp3`));
    }

    const audioUrl = req.body.url || req.body.file;
    if (audioUrl && validate.url(audioUrl)) {
        const resp = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 60000 });
        return sendSuccessResponse(res, await transcribe(Buffer.from(resp.data), `audio_${Date.now()}.mp3`));
    }
    throw new ValidationError('Wajib isi salah satu: upload file audio (field: "file") atau kirim URL audio (field: "url").');
}));

router.metadata = [{
    name:'AI Dictation (Audio to Text)', path:'/api/ai/aidictation', methods:['GET','POST'], category:'AI',
    description:'Transkripsi audio ke teks via AIDictation. GET: kirim URL audio via param "url". POST: upload file (field: file) ATAU kirim URL via param "url". Support MP3, WAV, M4A.',
    params:[
        { name:'url',  type:'text',         required:false, placeholder:'https://example.com/audio.mp3', description:'URL file audio — GET: wajib, POST: opsional (alternatif dari upload file)' },
        { name:'file', type:'file (audio)', required:false, description:'Upload file audio langsung (POST only, field: file — alternatif dari url)' },
    ],
}];

module.exports = router;
