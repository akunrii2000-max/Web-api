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

const _imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Tipe file tidak diizinkan. Gunakan: JPEG, PNG, WEBP, atau GIF.'), false);
};
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: _imageFilter });

router.get('/api/ai/waifutagger', asyncHandler(async (req, res) => {
    const { url, model = 'SmilingWolf/wd-swinv2-tagger-v3' } = req.query;
    if (!url) throw new ValidationError('Parameter "url" (URL gambar) wajib diisi untuk GET request.');
    if (!validate.url(url)) throw new ValidationError('Parameter "url" tidak valid.');
    const models = ['SmilingWolf/wd-swinv2-tagger-v3', 'SmilingWolf/wd-eva02-large-tagger-v3', 'SmilingWolf/wd-vit-large-tagger-v3', 'SmilingWolf/wd-vit-tagger-v3'];
    if (!models.includes(model)) throw new ValidationError(`Available models: ${models.join(', ')}`);
    const imageResp = await axios.get(url, { responseType: 'arraybuffer' });
    const api_url = 'https://smilingwolf-wd-tagger.hf.space/gradio_api';
    const form = new FormData();
    form.append('files', Buffer.from(imageResp.data), `rynn_${Date.now()}.jpg`);
    const upload_res = await axios.post(`${api_url}/upload?upload_id=${Math.random().toString(36).substring(2)}`, form, { headers: form.getHeaders() });
    const session_hash = Math.random().toString(36).substring(2);
    await axios.post(`${api_url}/queue/join?`, { data: [{ path: upload_res.data[0], url: `https://smilingwolf-wd-tagger.hf.space/gradio_api/file=${upload_res.data[0]}`, orig_name: `rynn_${Date.now()}.jpg`, size: imageResp.data.length, mime_type: 'image/jpeg', meta: { _type: 'gradio.FileData' } }, model, 0.35, false, 0.85, false], event_data: null, fn_index: 2, trigger_id: 18, session_hash });
    const { data: streamData } = await axios.get(`${api_url}/queue/data?session_hash=${session_hash}`);
    let result;
    for (const line of streamData.split('\n\n')) {
        if (line.startsWith('data:')) { const d = JSON.parse(line.substring(6)); if (d.msg === 'process_completed') result = d.output.data; }
    }
    sendSuccessResponse(res, { character: { name: result[2]?.label, confidences: result[2]?.confidences }, rating: result[1].confidences, prompt: result[0], tags: { name: result[3]?.label, confidences: result[3]?.confidences } });
}));

router.post('/api/ai/waifutagger', _handleUpload(upload.single('image')), asyncHandler(async (req, res) => {
    const api_url = 'https://smilingwolf-wd-tagger.hf.space/gradio_api';
    const models = ['SmilingWolf/wd-swinv2-tagger-v3', 'SmilingWolf/wd-eva02-large-tagger-v3', 'SmilingWolf/wd-vit-large-tagger-v3', 'SmilingWolf/wd-vit-tagger-v3'];
    const model = req.body.model || 'SmilingWolf/wd-swinv2-tagger-v3';
    if (!models.includes(model)) throw new ValidationError(`Available models: ${models.join(', ')}`);
    let imgBuf;
    if (req.file?.buffer) {
        imgBuf = req.file.buffer;
    } else {
        const imageUrl = req.body.url || req.body.image;
        if (!imageUrl || !validate.url(imageUrl)) throw new ValidationError('Wajib isi salah satu: upload gambar (field: "image") atau kirim URL gambar (field: "url").');
        const imageResp = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        imgBuf = Buffer.from(imageResp.data);
    }
    const form = new FormData();
    form.append('files', imgBuf, `rynn_${Date.now()}.jpg`);
    const upload_res = await axios.post(`${api_url}/upload?upload_id=${Math.random().toString(36).substring(2)}`, form, { headers: form.getHeaders() });
    const session_hash = Math.random().toString(36).substring(2);
    await axios.post(`${api_url}/queue/join?`, { data: [{ path: upload_res.data[0], url: `https://smilingwolf-wd-tagger.hf.space/gradio_api/file=${upload_res.data[0]}`, orig_name: `rynn_${Date.now()}.jpg`, size: imgBuf.length, mime_type: 'image/jpeg', meta: { _type: 'gradio.FileData' } }, model, 0.35, false, 0.85, false], event_data: null, fn_index: 2, trigger_id: 18, session_hash });
    const { data: streamData } = await axios.get(`${api_url}/queue/data?session_hash=${session_hash}`);
    let result;
    for (const line of streamData.split('\n\n')) {
        if (line.startsWith('data:')) { const d = JSON.parse(line.substring(6)); if (d.msg === 'process_completed') result = d.output.data; }
    }
    sendSuccessResponse(res, { character: { name: result[2]?.label, confidences: result[2]?.confidences }, rating: result[1].confidences, prompt: result[0], tags: { name: result[3]?.label, confidences: result[3]?.confidences } });
}));

router.metadata = [
  {
    name: 'Waifu Tagger',
    path: '/api/ai/waifutagger',
    methods: ['GET', 'POST'],
    category: 'AI',
    description: 'Tag konten anime image menggunakan WD Tagger. GET: kirim URL via param "url". POST: upload gambar (field: image) ATAU kirim URL (field: "url").',
    params: [
      { name: 'url',   type: 'text',        required: false, placeholder: 'https://example.com/anime.jpg', description: 'URL gambar — GET: wajib, POST: opsional (alternatif dari upload)' },
      { name: 'image', type: 'file (image)', required: false, description: 'Upload gambar anime/ilustrasi (POST only, field: image — alternatif dari url)' },
      {
        name: 'model',
        type: 'string',
        required: false,
        placeholder: 'wd-v1-4-moat-tagger-v2',
        description: 'WD Tagger model. Default: wd-v1-4-moat-tagger-v2',
        default: 'wd-v1-4-moat-tagger-v2',
        options: [
          { value: 'wd-v1-4-moat-tagger-v2',         label: 'WD v1.4 MOAT Tagger v2 (default)' },
          { value: 'wd-v1-4-convnext-tagger-v2',      label: 'WD v1.4 ConvNext Tagger v2' },
          { value: 'wd-v1-4-convnextv2-tagger-v2',    label: 'WD v1.4 ConvNextV2 Tagger v2' },
          { value: 'wd-v1-4-vit-tagger-v2',           label: 'WD v1.4 ViT Tagger v2' },
          { value: 'wd-swinv2-tagger-v3',             label: 'WD SwinV2 Tagger v3' },
          { value: 'wd-convnext-tagger-v3',           label: 'WD ConvNext Tagger v3' },
          { value: 'wd-vit-tagger-v3',                label: 'WD ViT Tagger v3' },
          { value: 'wd-vit-large-tagger-v3',          label: 'WD ViT Large Tagger v3' },
          { value: 'wd-eva02-large-tagger-v3',        label: 'WD EVA02 Large Tagger v3' },
        ],
      },
    ],
  },
];

module.exports = router;
