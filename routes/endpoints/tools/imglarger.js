'use strict';
const { Router }  = require('express');
const axios       = require('axios');
const FormData    = require('form-data');
const multer      = require('multer');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router   = Router();

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
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Tipe file tidak diizinkan. Gunakan: JPEG, PNG, atau WEBP.'), false);
};
const upload   = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: _imageFilter });
const UA       = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36';
const TYPE_MAP = { upscale: 13, enhance: 2, sharpener: 1 };

async function runImgLarger(buf, type, scale) {
    if (!TYPE_MAP[type]) throw new ValidationError(`Available types: ${Object.keys(TYPE_MAP).join(', ')}.`);
    if (type==='upscale' && !['2','4'].includes(String(scale))) throw new ValidationError('Scale harus 2 atau 4.');
    const form = new FormData();
    form.append('file', buf, `img_${Date.now()}.jpg`);
    form.append('type', String(TYPE_MAP[type]));
    if (type!=='sharpener') form.append('scaleRadio', type==='upscale' ? String(scale) : '1');
    const bh = { accept:'application/json, text/plain, */*', origin:'https://imglarger.com', referer:'https://imglarger.com/', 'user-agent':UA };
    const { data: up } = await axios.post('https://photoai.imglarger.com/api/PhoAi/Upload', form, { headers:{...form.getHeaders(),...bh} });
    if (!up.data?.code) throw new Error('Upload ke ImgLarger gagal.');
    for (let i=0; i<24; i++) {
        await new Promise(r=>setTimeout(r,5000));
        const { data: s } = await axios.post('https://photoai.imglarger.com/api/PhoAi/CheckStatus', {code:up.data.code,type:TYPE_MAP[type]}, {headers:{'content-type':'application/json',...bh}});
        if (s.data?.status==='waiting') continue;
        if (s.data?.status==='success') return s.data.downloadUrls[0];
        throw new Error(`ImgLarger gagal: ${s.data?.status||'unknown'}`);
    }
    throw new ValidationError('Processing timeout. Coba lagi.', 504);
}

router.get('/api/tools/imglarger', asyncHandler(async (req, res) => {
    const { url, type='upscale', scale='2' } = req.query;
    if (!url) throw new ValidationError('Parameter "url" wajib diisi untuk GET request.');
    if (!validate.url(url)) throw new ValidationError('Parameter "url" tidak valid.');
    const resp = await axios.get(url, { responseType:'arraybuffer', timeout:30000 });
    sendSuccessResponse(res, { url: await runImgLarger(Buffer.from(resp.data), type, scale) });
}));

router.post('/api/tools/imglarger', _handleUpload(upload.single('image')), asyncHandler(async (req, res) => {
    const { scale='2', type='upscale' } = req.body;
    let imgBuf;
    if (req.file?.buffer) {
        imgBuf = req.file.buffer;
    } else {
        const imageUrl = req.body.url || req.body.image;
        if (!imageUrl || !validate.url(imageUrl)) throw new ValidationError('Wajib isi salah satu: upload gambar (field: "image") atau kirim URL gambar (field: "url").');
        const resp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
        imgBuf = Buffer.from(resp.data);
    }
    sendSuccessResponse(res, { url: await runImgLarger(imgBuf, type, scale) });
}));

router.metadata = [{
    name:'ImgLarger (AI Upscale)', path:'/api/tools/imglarger', methods:['GET','POST'], category:'TOOLS',
    description:'Upscale/enhance gambar menggunakan AI ImgLarger. GET: kirim URL gambar. POST: upload file (field: image).',
    params:[
        { name:'url',   type:'text',        required:false, placeholder:'https://example.com/foto.jpg', description:'URL gambar — GET: wajib, POST: opsional (alternatif dari upload)' },
        { name:'image', type:'file (image)', required:false, description:'Upload gambar (POST only, field: image — alternatif dari url)' },
        { name:'type',  type:'text', required:false, default:'upscale', placeholder:'upscale', description:'Mode: upscale, enhance, sharpener',
          options:[{value:'upscale',label:'Upscale (perbesar)'},{value:'enhance',label:'Enhance (perbaiki)'},{value:'sharpener',label:'Sharpener (pertajam)'}] },
        { name:'scale', type:'text', required:false, default:'2', placeholder:'2', description:'Scale factor upscale: 2 atau 4',
          options:[{value:'2',label:'2x'},{value:'4',label:'4x'}] },
    ],
}];

module.exports = router;
