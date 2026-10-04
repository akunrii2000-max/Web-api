'use strict';

/*
═══════════════════════════════════════════════════════════════════
ENDPOINT: /api/ai/removebg — hapus background gambar lewat remove.bg
(session scraping + trust token, AXIOS ONLY, tanpa FlareSolverr)

Sumber logic: plugin WhatsApp "removebg/hapusbg/rembg/rbg" yang sudah
ditest manual dan terbukti jalan (session -> trust token -> upload ->
poll). Diadaptasi ke pola endpoint project ini:
  - CommonJS (require), bukan ESM.
  - Upload multipart dibangun manual pakai Buffer (axios only, TANPA
    paket 'form-data' dan TANPA fetch/FormData/Blob native), sama
    persis dengan versi yang sudah ditest.
  - Hasil dikembalikan sebagai file gambar langsung (Content-Type:
    image/png) — mengikuti pola routes/endpoints/ai/removebg-local.js
    yang sudah ada di project ini (bukan lewat CDN), supaya konsisten
    dengan endpoint "Remove Background" lain.
  - GET (?url=) dan POST (upload file ATAU url di body) didukung,
    sama seperti endpoint AI lain di project ini.
═══════════════════════════════════════════════════════════════════
*/

const { Router } = require('express');
const axios      = require('axios');
const multer     = require('multer');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

const BASE_URL = 'https://www.remove.bg';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const POLL_INTERVAL = 3000;
const MAX_POLL = 60;

/* ─── Cookie jar sederhana ────────────────────────────────────────────── */

class CookieJar {
  constructor() {
    this.jar = new Map();
  }
  get header() {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  absorb(headers) {
    const setCookie = headers.getSetCookie ? headers.getSetCookie() : headers['set-cookie'];
    const all = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    for (const line of all) {
      const i = line.indexOf('=');
      if (i <= 0) continue;
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).split(';')[0];
      if (k) this.jar.set(k, v);
    }
  }
}

const parseUseToken = (req) => (req.match(/useToken\(\s*['"]([^'"]+)['"]\s*\)/) || [])[1] || null;

async function initSession() {
  const jar = new CookieJar();
  const res = await axios.get(`${BASE_URL}/uploads`, {
    headers: { 'User-Agent': UA },
    timeout: 30000,
    validateStatus: () => true,
  });
  if (res.status !== 200) throw new Error(`Session fetch HTTP ${res.status}`);
  jar.absorb(res.headers);
  const csrf = (res.data.match(/name="csrf-token"\s+content="([^"]+)"/) || [])[1];
  if (!csrf) throw new Error('CSRF token tidak ditemukan');
  return { jar, csrf, ua: UA };
}

async function trustCall(ctx, body) {
  const { data } = await axios.post(`${BASE_URL}/trust_tokens`, body, {
    headers: {
      'User-Agent': ctx.ua,
      Cookie: ctx.jar.header,
      'X-CSRF-Token': ctx.csrf,
      Origin: BASE_URL,
      Referer: `${BASE_URL}/uploads`,
    },
    timeout: 15000,
  });
  return data;
}

async function getTrustToken(ctx) {
  const data = await trustCall(ctx, {});
  const t = parseUseToken(data.request || '');
  if (t) return t;
  if ((data.request || '').includes('hcaptcha')) {
    const e = new Error('remove.bg meminta hCaptcha (IP dibatasi/tracked). Coba lagi nanti.');
    e.hcaptcha = true;
    throw e;
  }
  throw new Error('Gagal mendapatkan trust token (browser challenge).');
}

async function acquireTrustToken(ctx) {
  ctx.token = await getTrustToken(ctx);
}

/* ─── Upload multipart — axios only, body dibangun manual ────────────── */

function buildMultipart(fields, fileField, buffer, filename, mimeType) {
  const boundary = '----RBGForm' + Date.now().toString(16) + Math.random().toString(16).slice(2);
  const parts = [];

  for (const [key, val] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`, 'utf8'));
  }

  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\nContent-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`,
      'utf8'
    )
  );
  parts.push(buffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));

  return { body: Buffer.concat(parts), boundary };
}

async function uploadImage(ctx, buffer, mimeType, filename) {
  const { body, boundary } = buildMultipart({ trust_token: ctx.token }, 'image[original]', buffer, filename, mimeType);

  const { data } = await axios.post(`${BASE_URL}/images`, body, {
    headers: {
      'User-Agent': ctx.ua,
      Cookie: ctx.jar.header,
      'X-CSRF-Token': ctx.csrf,
      Origin: BASE_URL,
      Referer: `${BASE_URL}/uploads`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 60000,
    validateStatus: () => true,
  });

  if (!data || !data.id) throw new Error('Upload gagal: ' + JSON.stringify(data || {}).slice(0, 200));
  return data.id;
}

async function pollResult(ctx, id) {
  for (let i = 0; i < MAX_POLL; i++) {
    const res = await axios.get(`${BASE_URL}/images/inline/${id}`, {
      headers: {
        'User-Agent': ctx.ua,
        Cookie: ctx.jar.header,
        Referer: `${BASE_URL}/uploads`,
      },
      timeout: 20000,
    });
    const d = res.data && res.data.data && res.data.data[0];
    if (!d) throw new Error('Data polling tidak ditemukan');
    const st = (d.preview_result && d.preview_result.state) || d.state;
    if (st === 'finished') {
      const url = d.preview_result && d.preview_result.url;
      if (!url) throw new Error('URL hasil tidak ada');
      const r = await axios.get(url, {
        headers: { 'User-Agent': ctx.ua },
        responseType: 'arraybuffer',
        timeout: 60000,
      });
      return Buffer.from(r.data);
    }
    if (st === 'error') {
      throw new Error((d.preview_result && (d.preview_result.error_message || d.preview_result.error_code)) || 'remove.bg gagal memproses gambar ini.');
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
  throw new Error('Timeout menunggu hasil dari remove.bg.');
}

async function removeBgFromBuffer(buffer, mimeType, filename) {
  const ctx = await initSession();
  await acquireTrustToken(ctx);
  const id = await uploadImage(ctx, buffer, mimeType, filename);
  const result = await pollResult(ctx, id);
  if (!result || !result.length) throw new Error('Hasil kosong dari remove.bg.');
  return result;
}

async function downloadImageFromUrl(imageUrl) {
  try {
    const res = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 10,
      headers: { 'User-Agent': UA },
      validateStatus: () => true,
    });
    if (res.status !== 200) throw new ValidationError(`Gagal mengambil gambar dari URL (HTTP ${res.status}).`, 400);
    if (!res.data || res.data.byteLength === 0) throw new ValidationError('Data gambar dari URL kosong.', 400);
    const mimeType = res.headers['content-type'] || 'image/jpeg';
    return { buffer: Buffer.from(res.data), mimeType };
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError('Gagal mengambil gambar. Pastikan URL langsung mengarah ke file gambar.', 400);
  }
}

/* ─── Upload handler (multer, sama pola dengan endpoint AI lain) ─────── */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/octet-stream'].includes(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Tipe file tidak didukung. Gunakan JPG, PNG, atau WEBP.'), false);
  },
});

function handleUpload(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        return sendErrorResponse(res, err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file terlalu besar. Maksimum 10MB.' : 'Upload error: ' + err.message, 400);
      }
      return sendErrorResponse(res, err.message || 'Upload gagal.', 400);
    });
  };
}

function sendImage(res, buffer) {
  res.set({
    'Content-Type': 'image/png',
    'Content-Length': buffer.length,
    'Content-Disposition': 'inline; filename="removebg.png"',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  });
  res.end(buffer);
}

function handleRemoveBgError(error) {
  if (error && error.hcaptcha) return new ValidationError(error.message, 429);
  if (error instanceof ValidationError) return error;
  return new ValidationError(error.message || 'Gagal menghapus background.', 502);
}

/* ─── GET — pakai URL ─────────────────────────────────────────────────── */

router.get('/api/ai/removebg', asyncHandler(async (req, res) => {
  const url = req.query.url || req.query.image || req.query.img || '';

  const validation = validate.fields({ url }, {
    url: { required: true, type: 'url' },
  });
  if (!validation.valid) throw new ValidationError(validation.errors.join(', '), 400);

  const { buffer, mimeType } = await downloadImageFromUrl(url);
  const filename = `removebg_${Date.now()}.${(mimeType.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '')}`;

  let result;
  try {
    result = await removeBgFromBuffer(buffer, mimeType, filename);
  } catch (error) {
    throw handleRemoveBgError(error);
  }

  sendImage(res, result);
}));

/* ─── POST — upload file ATAU URL ─────────────────────────────────────── */

router.post('/api/ai/removebg', handleUpload(upload.single('image')), asyncHandler(async (req, res) => {
  if (req.file && req.file.buffer) {
    const mimeType = req.file.mimetype || 'image/jpeg';
    const filename = `removebg_${Date.now()}.${(mimeType.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '')}`;
    let result;
    try {
      result = await removeBgFromBuffer(req.file.buffer, mimeType, filename);
    } catch (error) {
      throw handleRemoveBgError(error);
    }
    return sendImage(res, result);
  }

  const url = req.body.url || req.body.image || req.body.img || '';
  if (url) {
    const { buffer, mimeType } = await downloadImageFromUrl(url);
    const filename = `removebg_${Date.now()}.${(mimeType.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '')}`;
    let result;
    try {
      result = await removeBgFromBuffer(buffer, mimeType, filename);
    } catch (error) {
      throw handleRemoveBgError(error);
    }
    return sendImage(res, result);
  }

  throw new ValidationError('Wajib isi salah satu: upload file gambar (field: "image") atau kirim URL gambar (field: "url").', 400);
}));

/* ─── Metadata ─────────────────────────────────────────────────────────── */

router.metadata = {
  name: 'Remove Background',
  path: '/api/ai/removebg',
  methods: ['GET', 'POST'],
  category: 'AI',
  description: 'Hapus background gambar via remove.bg (session scraping, tanpa API key remove.bg). Hasil dikembalikan sebagai file PNG transparan langsung.',
  params: [
    {
      name: 'url',
      type: 'text',
      required: false,
      placeholder: 'https://example.com/photo.jpg',
      description: 'URL gambar yang ingin dihapus backgroundnya (juga menerima: image, img).',
    },
    {
      name: 'image',
      type: 'file (image)',
      required: false,
      description: 'Upload file gambar langsung (JPG/PNG/WEBP, maks 10MB, POST only).',
    },
  ],
};

module.exports = router;
