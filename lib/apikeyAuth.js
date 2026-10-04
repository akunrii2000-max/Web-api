'use strict';

/**
 * MikuAI — API Key Authentication Middleware
 *
 * Semua endpoint /api/* wajib menyertakan apikey yang valid.
 * Key dapat dikirim via:
 *   - Query param : ?apikey=YOUR_KEY
 *   - Header      : x-api-key: YOUR_KEY
 *   - Bearer token: Authorization: Bearer YOUR_KEY
 *
 * API keys dikonfigurasi di .env sebagai MIKUAI_API_KEYS=key1,key2,...
 */

const CHANNEL = 'https://whatsapp.com/channel/0029Vb91qeW17Emm4TVqu53K';

function loadApiKeys() {
  const raw = process.env.MIKUAI_API_KEYS || '';
  if (!raw.trim()) {
    console.warn('[MikuAI] ⚠️  MIKUAI_API_KEYS belum diset di .env! Semua request akan ditolak.');
    return new Set();
  }
  const keys = raw.split(',').map(k => k.trim()).filter(Boolean);
  console.log('[MikuAI] 🔑 API Keys loaded:', keys.length, 'key(s)');
  return new Set(keys);
}

let _keys = null;

function getKeys() {
  if (!_keys) _keys = loadApiKeys();
  return _keys;
}

/**
 * Middleware: wajib apikey untuk semua route /api/*
 */
function apikeyRequired(req, res, next) {
  // Skip /api/endpoints (meta route, tidak perlu auth)
  if (req.path === '/api/endpoints') return next();

  // Ekstrak key dari berbagai sumber (termasuk body untuk multipart/json)
  const apikey =
    req.query.apikey ||
    req.query.api_key ||
    req.headers['x-api-key'] ||
    extractBearer(req.headers['authorization']) ||
    (req.body && (req.body.apikey || req.body.api_key)) ||
    '';

  if (!apikey) {
    return res.status(401).type('application/json').send(JSON.stringify({
      success : false,
      creator : 'mikuai',
      error   : 'API key diperlukan. Tambahkan ?apikey=YOUR_KEY pada request Anda.',
      hint    : 'Dapatkan API key Anda melalui channel resmi kami.',
      channel : CHANNEL,
    }, null, 2));
  }

  if (!getKeys().has(apikey)) {
    return res.status(403).type('application/json').send(JSON.stringify({
      success : false,
      creator : 'mikuai',
      error   : 'API key tidak valid atau sudah kadaluarsa.',
      hint    : 'Pastikan API key Anda benar. Hubungi admin jika masih bermasalah.',
      channel : CHANNEL,
    }, null, 2));
  }

  next();
}

function extractBearer(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return '';
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') return parts[1];
  return '';
}

module.exports = { apikeyRequired };
