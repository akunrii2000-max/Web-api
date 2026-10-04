'use strict';

const { Router } = require('express');
const axios      = require('axios');
const FormData   = require('form-data');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse }                     = require('../../../config/apikeyConfig');

const router   = Router();
const BASE_API = 'https://get1.imglarger.com';
const HEADERS  = {
  'User-Agent'     : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Accept'         : 'application/json, text/plain, */*',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Origin'         : 'https://imgupscaler.com',
  'Referer'        : 'https://imgupscaler.com/',
};

async function uploadImage(buffer, filename) {
  const form = new FormData();
  form.append('myfile',      buffer, filename);
  form.append('scaleRadio',  '2');
  const { data } = await axios.post(`${BASE_API}/api/UpscalerNew/UploadNew`, form, {
    headers: { ...HEADERS, ...form.getHeaders() },
  });
  return data;
}

async function checkStatus(code) {
  const { data } = await axios.post(`${BASE_API}/api/UpscalerNew/CheckStatusNew`, { code, scaleRadio: 2 }, {
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
  });
  return data;
}

async function waitForResult(code, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await checkStatus(code);
    if (result.code === 200 && result.data && (result.data.download_url || result.data.img_url || result.data.status === 'success')) {
      return result;
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new ValidationError('Timeout: proses upscale terlalu lama.', 504);
}

async function handle({ url, image, img }, res) {
  const imageUrl = url || image || img;
  if (!imageUrl || !validate.url(imageUrl)) throw new ValidationError('Parameter "url" gambar wajib diisi dan valid.');
  const imgRes   = await axios.get(imageUrl.trim(), { responseType: 'arraybuffer', timeout: 30000 });
  const buffer   = Buffer.from(imgRes.data);
  const ext      = (imageUrl.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
  const upload   = await uploadImage(buffer, `image.${ext}`);
  if (!upload?.data?.code) throw new ValidationError('Gagal upload gambar ke imgupscaler.');
  const result = await waitForResult(upload.data.code);
  sendSuccessResponse(res, { source_url: imageUrl, upload, result });
}

router.get('/api/tools/imgupscaler',  asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/tools/imgupscaler', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = {
  name       : 'Image Upscaler',
  path       : '/api/tools/imgupscaler',
  methods    : ['GET', 'POST'],
  category   : 'TOOLS',
  description: 'Perbesar resolusi gambar 2x menggunakan AI (imgupscaler.com).',
  params     : [{ name: 'url', type: 'string', required: true, description: 'URL gambar yang akan di-upscale' }],
};

module.exports = router;
