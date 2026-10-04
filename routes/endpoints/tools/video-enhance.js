'use strict';

const { Router }  = require('express');
const axios        = require('axios');
const FormData      = require('form-data');
const fs             = require('fs');
const path            = require('path');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse }                      = require('../../../config/apikeyConfig');

const router = Router();

// ── free.ai config (hardcoded, tanpa env) ───────────────────────────────────
const BASE  = 'https://free.ai';
const API   = 'https://api.free.ai';
const EMAIL    = 'dongtubecs@gmail.com';
const PASSWORD = '12345678';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const NOISE_LEVELS = ['low', 'med', 'high'];

// Cache sesi supaya tidak login ulang tiap request
let sessionCache = { jar: null, apiKey: null, expiry: 0 };

// ── utilitas cookie ──────────────────────────────────────────────────────────
function parseCookies(res) {
  const out = {};
  const raw = res.headers['set-cookie'] || [];
  for (const c of raw) {
    const m = c.match(/^([^=]+)=([^;]*)/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

function cookieHeader(cookies) {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

// ── 1. login ──────────────────────────────────────────────────────────────────
async function login() {
  const jar = {};
  const r1 = await axios.get(`${BASE}/login/`, {
    headers: { 'User-Agent': UA },
    maxRedirects: 5,
    validateStatus: () => true,
  });
  Object.assign(jar, parseCookies(r1));

  const html = r1.data || '';
  const fm = html.match(/name="csrfmiddlewaretoken" value="([^"]+)"/);
  if (!fm) throw new ValidationError('CSRF token tidak ditemukan di halaman login free.ai.', 502);
  const formToken = fm[1];

  const r2 = await axios.post(`${BASE}/login/`, new URLSearchParams({
    csrfmiddlewaretoken: formToken,
    email: EMAIL,
    password: PASSWORD,
  }), {
    headers: {
      'User-Agent':   UA,
      'Referer':      `${BASE}/login/`,
      'Origin':       BASE,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie':       cookieHeader(jar),
    },
    maxRedirects: 0,
    validateStatus: s => s === 302 || s === 200,
  });
  Object.assign(jar, parseCookies(r2));

  const ok = /(sessionid=[^;]+)/.test(cookieHeader(jar));
  if (!ok) throw new ValidationError('Login ke free.ai gagal — cek email/password.', 502);
  return jar;
}

// ── 2. session-token → api_key ───────────────────────────────────────────────
async function getSession(jar) {
  const csrf = (jar.csrftoken || '').split(';')[0].split('=').pop();
  const r = await axios.post(`${BASE}/api/v1/session-token/`, null, {
    headers: {
      'User-Agent':   UA,
      'Referer':      `${BASE}/`,
      'Origin':       BASE,
      'Cookie':       cookieHeader(jar),
      'X-CSRFToken':  csrf,
    },
    maxRedirects: 5,
    validateStatus: () => true,
  });
  const d = r.data || {};
  if (!d.authenticated || !d.api_key) {
    throw new ValidationError('Session free.ai tidak terautentikasi.', 502);
  }
  return d;
}

async function getSessionCached() {
  if (sessionCache.apiKey && Date.now() < sessionCache.expiry) return sessionCache;
  const jar = await login();
  const session = await getSession(jar);
  sessionCache = { jar, apiKey: session.api_key, plan: session.plan, credits: session.credits, expiry: Date.now() + 3600_000 };
  return sessionCache;
}

// ── mapping Content-Type → ekstensi (dipakai, bukan nebak dari URL) ──────────
const MIME_TO_EXT = {
  'video/mp4':        '.mp4',
  'video/quicktime':  '.mov',
  'video/webm':       '.webm',
  'video/x-matroska': '.mkv',
  'video/3gpp':       '.3gp',
  'video/x-msvideo':  '.avi',
  'video/mpeg':       '.mpeg',
  'video/ogg':        '.ogv',
};

// ── download video sumber (dari url yang dikirim user) ───────────────────────
// Deteksi berdasarkan isi respons (Content-Type / magic bytes), bukan dari
// nama/ekstensi di URL, supaya link slug tanpa ".mp4" tetap bisa diproses
// selama isinya memang video.
async function downloadVideo(videoUrl) {
  let response;
  try {
    response = await axios.get(videoUrl, {
      responseType: 'arraybuffer',
      timeout: 120000,
      maxRedirects: 10, // ikutin redirect (banyak share-link/slug redirect ke CDN asli)
      headers: {
        'User-Agent': UA,
        // sebagian CDN video butuh Accept header biar gak dibalikin HTML
        'Accept': 'video/*,application/octet-stream;q=0.9,*/*;q=0.8',
      },
    });
  } catch (e) {
    throw new ValidationError(`Gagal download video: ${e.message}`, 400);
  }

  const buffer = Buffer.from(response.data);
  let contentType = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();

  // Fallback: kalau server gak kasih Content-Type yang jelas, cek magic bytes
  // umum untuk container video (mp4/mov = 'ftyp' di offset 4, webm/mkv = EBML header).
  if (!contentType.startsWith('video/')) {
    const head = buffer.slice(0, 12).toString('hex');
    const ftyp = buffer.slice(4, 8).toString('ascii');
    if (ftyp === 'ftyp') {
      contentType = 'video/mp4';
    } else if (head.startsWith('1a45dfa3')) {
      contentType = 'video/webm';
    }
  }

  if (!contentType.startsWith('video/')) {
    throw new ValidationError(
      'URL tidak mengarah ke file video langsung (kemungkinan halaman/slug, bukan file video). Pastikan URL adalah direct link ke video.',
      400
    );
  }

  const ext = MIME_TO_EXT[contentType] || '.mp4';
  return { buffer, contentType, ext };
}

// ── 3. upload-temp + 4. enhance ───────────────────────────────────────────────
async function uploadTemp(apiKey, filePath, contentType) {
  const fd = new FormData();
  fd.append('file', fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: contentType || 'video/mp4',
  });
  const up = await axios.post(`${API}/v1/upload-temp/`, fd, {
    headers: { 'User-Agent': UA, 'Authorization': `Bearer ${apiKey}`, ...fd.getHeaders() },
    maxBodyLength: Infinity,
    validateStatus: () => true,
  });
  if (up.status !== 200) {
    throw new ValidationError('Upload ke free.ai gagal: ' + JSON.stringify(up.data || {}), 502);
  }
  return up.data;
}

async function enhance(apiKey, filePath, noise, contentType) {
  const fd = new FormData();
  fd.append('file', fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: contentType || 'video/mp4',
  });
  if (noise && NOISE_LEVELS.includes(noise)) fd.append('noise', noise);

  const r = await axios.post(`${API}/v1/video/enhance/`, fd, {
    headers: { 'User-Agent': UA, 'Authorization': `Bearer ${apiKey}`, ...fd.getHeaders() },
    timeout: 300000,
    maxBodyLength: Infinity,
    validateStatus: () => true,
  });
  if (r.status !== 200) {
    throw new ValidationError(`Enhance gagal (HTTP ${r.status}): ` + JSON.stringify(r.data || {}), 502);
  }
  return r.data;
}

async function enhanceVideo(videoUrl, noise) {
  const { buffer: videoBuffer, contentType, ext } = await downloadVideo(videoUrl);
  if (!videoBuffer || videoBuffer.length === 0) {
    throw new ValidationError('Gagal download video dari URL.', 400);
  }
  if (videoBuffer.length > 100 * 1024 * 1024) {
    throw new ValidationError('Ukuran video maksimal 100MB.', 400);
  }

  const tmpFile = path.join('/tmp', `enhance-${Date.now()}${ext}`);
  fs.writeFileSync(tmpFile, videoBuffer);

  try {
    const session = await getSessionCached();
    const uploadInfo = await uploadTemp(session.apiKey, tmpFile, contentType);
    const result = await enhance(session.apiKey, tmpFile, noise, contentType);

    return {
      video_url:    result.video_url || result.url,
      share_url:    result.share_url,
      duration:     result.duration,
      tokens_used:  result.tokens,
      noise:        result.noise,
      sharpness:    result.sharpness,
      color:        result.color,
      filter_chain: result.filter_chain,
      upload:       uploadInfo,
      account:      { plan: session.plan, credits: session.credits },
    };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (e) {}
  }
}

// ── Handler bersama GET & POST ────────────────────────────────────────────────
async function handle(input, res) {
  const url   = String(input.url || '').trim();
  const noise = String(input.noise || 'low');

  const v = validate.fields({ url }, { url: { required: true, type: 'string' } });
  if (!v.valid) throw new ValidationError(v.errors.join(', '), 400);

  if (!NOISE_LEVELS.includes(noise)) {
    throw new ValidationError(`noise harus salah satu dari: ${NOISE_LEVELS.join(', ')}`, 400);
  }

  sendSuccessResponse(res, await enhanceVideo(url, noise));
}

// ── GET ────────────────────────────────────────────────────────────────────────
router.get('/api/video/enhance', asyncHandler(async (req, res) => {
  await handle(req.query, res);
}));

// ── POST ───────────────────────────────────────────────────────────────────────
router.post('/api/video/enhance', asyncHandler(async (req, res) => {
  await handle(req.body, res);
}));

// ── Metadata ───────────────────────────────────────────────────────────────────
router.metadata = {
  name:        'Video Enhance',
  path:        '/api/video/enhance',
  methods:     ['GET', 'POST'],
  category:    'MEDIA',
  description: 'Tingkatkan kualitas video (AI quality boost) lewat free.ai — login, upload-temp, lalu enhance.',
  params: [
    { name: 'url',   type: 'text',   required: true,  placeholder: 'https://.../video.mp4', description: 'URL video sumber (bisa dari endpoint /download/*).' },
    { name: 'noise', type: 'select', required: false, value: ['low', 'med', 'high'], default: 'low', description: 'Level noise reduction.' },
  ],
};

module.exports = router;
