'use strict';

const { Router } = require('express');
const axios      = require('axios');
const multer     = require('multer');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');

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

const _imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Tipe file tidak diizinkan. Gunakan: JPEG, PNG, WEBP, atau GIF.'), false);
};
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: _imageFilter });

router.get('/api/ai/gptimage', asyncHandler(async (req, res) => {
    const models = ['gpt-image-1', 'gpt-image-1.5'];
    const { prompt, url, model = 'gpt-image-1' } = req.query;
    if (!prompt) throw new ValidationError('Parameter "prompt" wajib diisi.');
    if (!url) throw new ValidationError('Parameter "url" (URL gambar) wajib diisi untuk GET request.');
    if (!validate.url(url)) throw new ValidationError('Parameter "url" tidak valid.');
    if (!models.includes(model)) throw new ValidationError(`Available models: ${models.join(', ')}.`);
    const imageResp = await axios.get(url, { responseType: 'arraybuffer' });
    const imageBase64 = Buffer.from(imageResp.data).toString('base64');
    const mime = imageResp.headers['content-type'] || 'image/jpeg';
    const { data } = await axios.post('https://ghibli-proxy.netlify.app/.netlify/functions/ghibli-proxy', { image: `data:${mime};base64,${imageBase64}`, prompt, model, n: 1, size: 'auto', quality: 'low' }, { headers: { origin: 'https://overchat.ai', referer: 'https://overchat.ai/', 'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958) Chrome/130.0.6723.86 Mobile Safari/537.36' } });
    const result = data?.data?.[0]?.b64_json;
    if (!result) throw new Error('No result found.');
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(result, 'base64'));
}));

router.post('/api/ai/gptimage', _handleUpload(upload.single('image')), asyncHandler(async (req, res) => {
    const { sendSuccessResponse } = require('../../../config/apikeyConfig');
    const models = ['gpt-image-1', 'gpt-image-1.5'];
    const { prompt, model = 'gpt-image-1' } = req.body;
    if (!prompt) throw new ValidationError('Parameter "prompt" wajib diisi.');
    if (!models.includes(model)) throw new ValidationError(`Available models: ${models.join(', ')}.`);
    let imageBase64, mime;
    if (req.file?.buffer) {
        imageBase64 = req.file.buffer.toString('base64');
        mime = req.file.mimetype || 'image/jpeg';
    } else {
        const imageUrl = req.body.url || req.body.image;
        if (!imageUrl || !validate.url(imageUrl)) throw new ValidationError('Wajib isi salah satu: upload gambar (field: "image") atau kirim URL gambar (field: "url").');
        const imageResp = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        imageBase64 = Buffer.from(imageResp.data).toString('base64');
        mime = imageResp.headers['content-type'] || 'image/jpeg';
    }
    const { data } = await axios.post('https://ghibli-proxy.netlify.app/.netlify/functions/ghibli-proxy', { image: `data:${mime};base64,${imageBase64}`, prompt, model, n: 1, size: 'auto', quality: 'low' }, { headers: { origin: 'https://overchat.ai', referer: 'https://overchat.ai/', 'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958) Chrome/130.0.6723.86 Mobile Safari/537.36' } });
    const result = data?.data?.[0]?.b64_json;
    if (!result) throw new Error('No result found.');
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(result, 'base64'));
}));

router.metadata = [
  {
    name: 'GPT Image Edit',
    path: '/api/ai/gptimage',
    methods: ['GET', 'POST'],
    description: 'Edit gambar menggunakan GPT Image AI. Response berupa file PNG. GET: kirim URL via param "url". POST: upload gambar (field: image) ATAU kirim URL (field: "url").',
    params: [
      { name: 'url',    type: 'text',        required: false, placeholder: 'https://example.com/foto.jpg', description: 'URL gambar — GET: wajib, POST: opsional (alternatif dari upload)' },
      { name: 'image',  type: 'file (image)', required: false, description: 'Upload gambar yang akan diedit (POST only, field: image — alternatif dari url)' },
      { name: 'prompt', type: 'string',       required: true,  placeholder: 'Make the background a sunset beach', description: 'Instruksi editing gambar dalam bahasa Inggris' },
      {
        name: 'model',
        type: 'string',
        required: false,
        placeholder: 'gpt-image-1',
        description: 'Model GPT image. Default: gpt-image-1',
        default: 'gpt-image-1',
        options: [
          { value: 'gpt-image-1',     label: 'gpt-image-1 (latest)' },
          { value: 'dall-e-2',        label: 'DALL-E 2' },
          { value: 'dall-e-3',        label: 'DALL-E 3' },
        ],
      },
    ],
  },
];

module.exports = router;
