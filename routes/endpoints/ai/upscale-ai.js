'use strict';

const { Router } = require('express');
const axios       = require('axios');
const FormData    = require('form-data');
const multer      = require('multer');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse }   = require('../../../config/apikeyConfig');

const router = Router();

const BASE_API = 'https://get1.imglarger.com';
const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Origin':          'https://imgupscaler.com',
  'Referer':         'https://imgupscaler.com/',
};

// Upload gambar via multipart — maks 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/octet-stream'].includes(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Tipe file tidak didukung. Gunakan JPG, PNG, atau WEBP.'), false);
  },
});

function handleUpload(middleware) {
  return (req, res, next) => {
    middleware(req, res, err => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        return sendErrorResponse(res, err.code === 'LIMIT_FILE_SIZE'
          ? 'Ukuran file terlalu besar. Maksimum 10MB.'
          : 'Upload error: ' + err.message, 400);
      }
      return sendErrorResponse(res, err.message || 'Upload gagal.', 400);
    });
  };
}

async function downloadImage(imageUrl) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MikuAI-Bot/1.0)' },
    });
    return Buffer.from(response.data);
  } catch (e) {
    throw new ValidationError('Gagal download gambar. Cek kembali URL-nya.', 400);
  }
}

async function uploadImage(buffer, filename) {
  const form = new FormData();
  form.append('myfile', buffer, filename);
  form.append('scaleRadio', '2');

  const { data } = await axios.post(`${BASE_API}/api/UpscalerNew/UploadNew`, form, {
    headers: { ...HEADERS, ...form.getHeaders() },
    timeout: 60000,
  });
  return data;
}

async function checkStatus(code) {
  const { data } = await axios.post(`${BASE_API}/api/UpscalerNew/CheckStatusNew`, {
    code,
    scaleRadio: 2,
  }, {
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    timeout: 30000,
  });
  return data;
}

async function waitForResult(code, maxAttempts = 15) {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await checkStatus(code);
    if (result.code === 200 && result.data) {
      if (result.data.status === 'success' && result.data.downloadUrls && result.data.downloadUrls.length > 0) {
        return result.data;
      }
      if (result.data.download_url || result.data.img_url) {
        return result.data;
      }
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new ValidationError('Timeout: proses upscale terlalu lama.', 504);
}

async function upscaleImage(buffer, ext) {
  const filename = `image.${ext || 'jpg'}`;

  const uploadResp = await uploadImage(buffer, filename);
  if (!uploadResp?.data?.code) throw new ValidationError('Gagal upload gambar ke server upscaler.', 502);

  const result = await waitForResult(uploadResp.data.code);

  let downloadUrl = null;
  if (result.downloadUrls && result.downloadUrls.length > 0) downloadUrl = result.downloadUrls[0];
  else if (result.download_url)                              downloadUrl = result.download_url;
  else if (result.img_url)                                    downloadUrl = result.img_url;

  if (!downloadUrl) throw new ValidationError('Gagal mendapatkan URL hasil upscale.', 502);

  return {
    result_url: downloadUrl,
    scale:      '2x',
  };
}

// ── GET/POST via URL ─────────────────────────────────────────────────────────
async function handleByUrl(input, res) {
  const url = String(input.url || '').trim();
  const v = validate.fields({ url }, { url: { required: true, type: 'string' } });
  if (!v.valid) throw new ValidationError(v.errors.join(', '), 400);

  const buffer = await downloadImage(url);
  const ext = (url.split('.').pop() || 'jpg').split(/[?#]/)[0].slice(0, 5);

  sendSuccessResponse(res, await upscaleImage(buffer, ext));
}

router.get('/api/ai/upscale', asyncHandler(async (req, res) => {
  await handleByUrl(req.query, res);
}));

// multer hanya memproses body multipart; request non-multipart lewat tanpa efek,
// jadi satu handler ini menangani baik file upload maupun ?url=/body.url.
router.post('/api/ai/upscale', handleUpload(upload.single('image')), asyncHandler(async (req, res) => {
  if (req.file) {
    const ext = (req.file.mimetype.split('/')[1] || 'jpg').split(';')[0];
    return sendSuccessResponse(res, await upscaleImage(req.file.buffer, ext));
  }
  await handleByUrl(req.body, res);
}));

// ── Metadata ─────────────────────────────────────────────────────────────────
router.metadata = {
  name:        'AI Image Upscale (Remini)',
  path:        '/api/ai/upscale',
  methods:     ['GET', 'POST'],
  category:    'AI',
  description: 'Tingkatkan resolusi gambar 2x menggunakan AI. Terima URL gambar (?url=) atau upload file langsung (field "image").',
  params: [
    { name: 'url',   type: 'text', required: false, placeholder: 'https://.../image.jpg', description: 'URL gambar yang mau di-upscale (alternatif dari upload file).' },
    { name: 'image', type: 'file', required: false, description: 'File gambar (multipart/form-data), alternatif dari parameter url.' },
  ],
};

module.exports = router;
