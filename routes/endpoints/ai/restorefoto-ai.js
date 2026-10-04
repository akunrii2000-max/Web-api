'use strict';

/**
 * Restore Photo (AI Photo Enhancer)
 * Base: https://www.photorestore.io
 * Author: nath (adapted for MikuAI by Claude)
 */

const { Router }  = require('express');
const axios       = require('axios');
const multer      = require('multer');
const path        = require('path');

const { asyncHandler, ValidationError } = require('../../../utils/validation');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const RESTORE_URL = 'https://us-central1-ai-apps-prod.cloudfunctions.net/restorePhoto';

const VALID_SCALES = [1, 2, 4];
const EXT_TO_MIME  = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp' };

function bufferToDataUrl(buffer, mimeType) {
  const base64 = buffer.toString('base64');
  return `data:image/${mimeType};base64,${base64}`;
}

function extFromUrl(url) {
  try {
    const p = new URL(url).pathname;
    return path.extname(p).replace('.', '').toLowerCase() || 'jpeg';
  } catch {
    return 'jpeg';
  }
}

async function downloadImage(url) {
  try {
    const res = await axios.get(url, {
      responseType : 'arraybuffer',
      timeout      : 30000,
      headers      : { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    return { buffer: Buffer.from(res.data), contentType: res.headers['content-type'] || '' };
  } catch (err) {
    throw new ValidationError('Gagal download gambar dari URL: ' + err.message, 400);
  }
}

async function restorePhoto(imageBuffer, mimeType, scale) {
  const dataUrl = bufferToDataUrl(imageBuffer, mimeType);

  const res = await axios.post(RESTORE_URL, {
    model   : '9283608cc6b7be6b65a8e44983db012355fde4132009bf99d976b2f0896856a3',
    version : 'v1.4',
    scale,
    img     : dataUrl,
  }, {
    timeout : 120000,
    headers : {
      'accept'       : '*/*',
      'content-type' : 'application/json',
      'origin'       : 'https://www.photorestore.io',
      'referer'      : 'https://www.photorestore.io/',
      'user-agent'   : 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
    },
  });

  const resultUrl = typeof res.data === 'string' ? res.data.trim() : String(res.data).trim();
  if (!resultUrl || !resultUrl.startsWith('http')) {
    throw new ValidationError('API restore gagal mengembalikan URL hasil: ' + resultUrl, 502);
  }
  return resultUrl;
}

// ── Handler ──────────────────────────────────────────────────────────────────

async function handler(req, res) {
  const scaleRaw = req.body?.scale || req.query?.scale || '2';
  const scale    = parseInt(scaleRaw, 10);

  if (!VALID_SCALES.includes(scale)) {
    throw new ValidationError(`Parameter "scale" tidak valid. Gunakan: ${VALID_SCALES.join(', ')}`, 400);
  }

  let imageBuffer, mimeType;

  if (req.file) {
    imageBuffer = req.file.buffer;
    mimeType    = req.file.mimetype.replace('image/', '') || 'jpeg';
    mimeType    = mimeType === 'jpg' ? 'jpeg' : mimeType;
  } else {
    const url = req.body?.url || req.query?.url;
    if (!url) throw new ValidationError('Wajib menyertakan file gambar (upload) atau parameter "url"', 400);

    const { buffer, contentType } = await downloadImage(url);
    imageBuffer = buffer;

    // Detect MIME from Content-Type header or URL extension
    const ctMatch = contentType.match(/image\/(jpeg|jpg|png|webp)/i);
    if (ctMatch) {
      mimeType = ctMatch[1] === 'jpg' ? 'jpeg' : ctMatch[1];
    } else {
      const ext = extFromUrl(url);
      mimeType  = EXT_TO_MIME[ext] || 'jpeg';
    }
  }

  const resultUrl = await restorePhoto(imageBuffer, mimeType, scale);

  res.set('Content-Type', 'application/json');
  res.status(200).send(JSON.stringify({
    success : true,
    creator : 'mikuai',
    results : {
      url   : resultUrl,
      scale : scale,
    },
  }, null, 2));
}

router.get('/api/ai/restorefoto',
  asyncHandler(handler)
);

router.post('/api/ai/restorefoto',
  upload.single('image'),
  asyncHandler(handler)
);

router.metadata = {
  name        : 'Restore Foto AI',
  path        : '/api/ai/restorefoto',
  methods     : ['GET', 'POST'],
  category    : 'AI',
  description : 'Perbaiki dan enhance foto lama/buram menggunakan AI photorestore.io. Kirim via URL (GET/POST) atau upload file (POST multipart). Hasil berupa URL gambar yang sudah diperbaiki.',
  params: [
    {
      name        : 'url',
      type        : 'text',
      required    : false,
      placeholder : 'https://example.com/old-photo.jpg',
      description : 'URL foto yang ingin diperbaiki. Gunakan ini atau upload file.',
    },
    {
      name        : 'image',
      type        : 'file (image)',
      required    : false,
      placeholder : 'Upload file foto',
      description : 'File foto (JPG/PNG, maks 10MB). Jika ada file upload, parameter url diabaikan.',
    },
    {
      name        : 'scale',
      type        : 'text',
      required    : false,
      placeholder : '2',
      description : 'Faktor upscale: 1, 2, atau 4. Default: 2',
      default     : '2',
      options     : [
        { value: '1', label: '1x — Original size' },
        { value: '2', label: '2x — 2× upscale (default)' },
        { value: '4', label: '4x — 4× upscale' },
      ],
    },
  ],
};

module.exports = router;
