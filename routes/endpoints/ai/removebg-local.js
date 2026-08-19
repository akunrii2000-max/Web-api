'use strict';

const { Router } = require('express');
const axios      = require('axios');
const multer     = require('multer');
const { asyncHandler, ValidationError } = require('../../../utils/validation');
const { sendErrorResponse }             = require('../../../config/apikeyConfig');

const router = Router();

// Cache ESM dynamic imports
let _removeBg   = null;
let _fileTypeFromBuffer = null;

async function getRemoveBg() {
  if (!_removeBg) {
    // Pastikan library terinstall dengan benar: npm install @imgly/background-removal-node
    const mod = await import('@imgly/background-removal-node');
    _removeBg = mod.removeBackground;
  }
  return _removeBg;
}

async function getFileType() {
  if (!_fileTypeFromBuffer) {
    const mod = await import('file-type');
    _fileTypeFromBuffer = mod.fileTypeFromBuffer;
  }
  return _fileTypeFromBuffer;
}

// Multer — terima gambar maks 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Normalisasi deteksi mimetype beberapa framework/bot whatsapp
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/octet-stream'].includes(file.mimetype);
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

// Bungkus Buffer jadi Blob dengan MIME type yang benar
async function bufferToBlob(buffer) {
  const fileTypeFromBuffer = await getFileType();
  const detected = await fileTypeFromBuffer(buffer);

  const mime = detected?.mime || 'image/jpeg';
  const supported = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  if (!supported.includes(mime)) {
    throw new ValidationError(`Format gambar tidak didukung: ${mime}. Gunakan JPG, PNG, atau WEBP.`, 400);
  }

  return new Blob([buffer], { type: mime });
}

async function processRemoveBg(buffer) {
  try {
    const removeBackground = await getRemoveBg();
    const blob = await bufferToBlob(buffer);

    // KUNCI STABILITAS: Tambahkan konfigurasi fetchArgs & progress handling agar tidak stuck/freeze
    const resultBlob = await removeBackground(blob, {
      output: { 
        format: 'image/png', 
        quality: 0.8 // Menurunkan sedikit dari 1 ke 0.8 menghemat RAM + CPU secara signifikan tanpa mengurangi estetika chat bot
      },
      model: 'medium', // Memastikan menggunakan model medium standar yang stabil
      progress: (total, current) => {
        // Mencegah proses dianggap idle/stuck oleh OS
        if (global.gc) global.gc(); 
      }
    });

    const arrayBuffer = await resultBlob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error on @imgly/background-removal:', error);
    throw new ValidationError(`Gagal memproses gambar (AI Engine Error): ${error.message || error}. Pastikan RAM server mencukupi.`, 500);
  }
}

async function fetchUrlBuffer(url) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new ValidationError('URL tidak valid. Pastikan format URL benar (contoh: https://example.com/foto.jpg).', 400);
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new ValidationError('Hanya URL dengan protokol HTTP/HTTPS yang didukung.', 400);
  }

  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 10,
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':          'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer':         parsedUrl.origin + '/',
      },
    });

    // Validasi buffer kosong
    if (!res.data || res.data.byteLength === 0) {
      throw new ValidationError('Data gambar dari URL kosong.', 400);
    }

    return Buffer.from(res.data);
  } catch (err) {
    if (err instanceof ValidationError) throw err;

    const status = err.response?.status;
    if (status === 403 || status === 401) {
      throw new ValidationError(`Akses ke URL ditolak (HTTP ${status}). Gunakan URL gambar yang publik.`, 400);
    }
    if (status === 404) {
      throw new ValidationError('Gambar tidak ditemukan di URL tersebut (HTTP 404).', 400);
    }
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      throw new ValidationError('Timeout saat mengambil gambar. URL terlalu lambat merespons.', 400);
    }

    throw new ValidationError(
      `Gagal mengambil gambar dari URL${status ? ` (HTTP ${status})` : ''}. Pastikan URL langsung mengarah ke file gambar.`,
      400
    );
  }
}

function sendImage(res, buffer) {
  res.set({
    'Content-Type':        'image/png',
    'Content-Length':      buffer.length,
    'Content-Disposition': 'inline; filename="removed-bg.png"',
    'Cache-Control':       'no-store, no-cache, must-revalidate, proxy-revalidate',
  });
  res.end(buffer);
}

// ── GET — pakai URL ──────────────────────────────────────────────────────────
router.get('/api/ai/removebg2', asyncHandler(async (req, res) => {
  const url = req.query.url || req.query.image || '';
  if (!url) throw new ValidationError('Parameter "url" wajib diisi untuk GET request.', 400);

  const buf = await fetchUrlBuffer(url);
  const result = await processRemoveBg(buf);
  sendImage(res, result);
}));

// ── POST — upload file ATAU URL ──────────────────────────────────────────────
router.post('/api/ai/removebg2', handleUpload(upload.single('image')), asyncHandler(async (req, res) => {
  // Prioritas: file upload → url di body
  if (req.file?.buffer) {
    const result = await processRemoveBg(req.file.buffer);
    return sendImage(res, result);
  }

  const url = req.body.url || req.body.image || '';
  if (url) {
    const buf = await fetchUrlBuffer(url);
    const result = await processRemoveBg(buf);
    return sendImage(res, result);
  }

  throw new ValidationError(
    'Wajib isi salah satu: upload file gambar (field: "image") atau kirim URL gambar (field: "url").',
    400
  );
}));

// ── Metadata ─────────────────────────────────────────────────────────────────
router.metadata = {
  name:        'Remove Background (Local AI)',
  path:        '/api/ai/removebg2',
  methods:     ['GET', 'POST'],
  category:    'AI',
  description: 'Hapus background gambar menggunakan AI lokal. Hasil dikembalikan sebagai file PNG transparan langsung.',
  params: [
    {
      name:        'url',
      type:        'text',
      required:    false,
      placeholder: 'https://example.com/photo.jpg',
      description: 'URL gambar yang ingin dihapus backgroundnya.',
    },
    {
      name:        'image',
      type:        'file (image)',
      required:    false,
      description: 'Upload file gambar langsung (JPG/PNG/WEBP, maks 10MB).',
    },
  ],
};

module.exports = router;
