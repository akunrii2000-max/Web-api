'use strict';

const { Router }  = require('express');
const axios       = require('axios');
const FormData    = require('form-data');
const multer      = require('multer');
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
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: _imageFilter });

router.get('/api/tools/nsfwchecker', asyncHandler(async (req, res) => {
    const { url } = req.query;
    if (!url) throw new ValidationError('Parameter "url" (URL gambar) wajib diisi untuk GET request.');
    if (!validate.url(url)) throw new ValidationError('Parameter "url" tidak valid.');
    const imageResp = await axios.get(url, { responseType: 'arraybuffer' });
    const form = new FormData();
    form.append('file', Buffer.from(imageResp.data), `${Date.now()}_check.jpg`);
    const { data } = await axios.post('https://www.nyckel.com/v1/functions/o2f0jzcdyut2qxhu/invoke', form, { headers: form.getHeaders() });
    sendSuccessResponse(res, data);
}));

router.post('/api/tools/nsfwchecker', _handleUpload(upload.single('image')), asyncHandler(async (req, res) => {
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
    form.append('file', imgBuf, `${Date.now()}_check.jpg`);
    const { data } = await axios.post('https://www.nyckel.com/v1/functions/o2f0jzcdyut2qxhu/invoke', form, { headers: form.getHeaders() });
    sendSuccessResponse(res, data);
}));

router.metadata = [
    { name: 'NSFW Checker', path: '/api/tools/nsfwchecker', methods: ['GET', 'POST'], category: 'TOOLS',
      description: 'Cek apakah gambar mengandung konten NSFW. GET: kirim URL via param "url". POST: upload gambar (field: image) ATAU kirim URL (field: "url").',
      params: [
        { name: 'url',   type: 'text',        required: false, placeholder: 'https://example.com/foto.jpg', description: 'URL gambar — GET: wajib, POST: opsional (alternatif dari upload)' },
        { name: 'image', type: 'file (image)', required: false, description: 'Upload gambar langsung (POST only, field: image — alternatif dari url)' },
      ]
    },
];

module.exports = router;
