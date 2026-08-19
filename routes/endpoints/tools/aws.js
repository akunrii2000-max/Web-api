'use strict';
const { Router } = require('express');
const multer     = require('multer');
const crypto     = require('crypto');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');
const { cdnUploadFile, _cdnSanitizeError } = require('../../../lib/cdn');

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

const _allowedExts = new Set(['.jpg','.jpeg','.png','.gif','.webp','.mp4','.mp3','.wav','.ogg','.pdf','.txt','.zip']);
const _fileFilter = (req, file, cb) => {
  const ext = require('path').extname(file.originalname || '').toLowerCase();
  if (_allowedExts.has(ext)) cb(null, true);
  else cb(new Error('Tipe file tidak diizinkan.'), false);
};
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: _fileFilter });

function guessExt(ct) {
    const map = {'image/jpeg':'.jpg','image/png':'.png','image/gif':'.gif','image/webp':'.webp','video/mp4':'.mp4','audio/mpeg':'.mp3','application/pdf':'.pdf','application/zip':'.zip'};
    return map[(ct||'').split(';')[0].trim()]||'.bin';
}
function buildFilename(rawSlug, fallbackExt) {
    const slug = rawSlug.replace(/[^a-zA-Z0-9\-_.]/g,'-').replace(/-{2,}/g,'-').replace(/^[-.]|[-.]$/g,'').slice(0,80);
    if (!slug) return null;
    return /\.[a-z0-9]{1,6}$/i.test(slug) ? slug : slug + fallbackExt;
}

router.get('/api/tools/fileupload', asyncHandler(async (req, res) => {
    const { url: fileUrl, filename: fn } = req.query;
    if (!fileUrl) throw new ValidationError('Parameter "url" wajib diisi untuk GET request.');
    if (!validate.url(fileUrl)) throw new ValidationError('Parameter "url" tidak valid.');
    const resp   = await axios.get(fileUrl, { responseType: 'arraybuffer', timeout: 30000 });
    const buffer = Buffer.from(resp.data);
    const ext    = guessExt(resp.headers['content-type']);
    const rawSlug = String(fn||'').trim();
    const filename = rawSlug ? (buildFilename(rawSlug,ext) || (() => {throw new ValidationError('Nama file tidak valid.');})()) : crypto.randomBytes(8).toString('hex')+ext;
    let cdnPath;
    try { cdnPath = await cdnUploadFile(filename, buffer); } catch(e) { throw new Error(_cdnSanitizeError(e)); }
    sendSuccessResponse(res, { url: req.protocol+'://'+req.get('host')+cdnPath, path: cdnPath, filename, size: buffer.length });
}));

router.post('/api/tools/fileupload', _handleUpload(upload.single('file')), asyncHandler(async (req, res) => {
    if (!req.file?.buffer) throw new ValidationError('Upload file (field: "file") wajib diisi.');
    const origName = req.file.originalname||'file';
    const dotIdx   = origName.lastIndexOf('.');
    const ext      = dotIdx>=0 ? origName.slice(dotIdx).toLowerCase() : '.bin';
    const rawSlug  = String(req.body.filename||'').trim();
    const filename = rawSlug ? (buildFilename(rawSlug,ext) || (() => {throw new ValidationError('Nama file tidak valid.');})()) : crypto.randomBytes(8).toString('hex')+ext;
    let cdnPath;
    try { cdnPath = await cdnUploadFile(filename, req.file.buffer); } catch(e) { throw new Error(_cdnSanitizeError(e)); }
    sendSuccessResponse(res, { url: req.protocol+'://'+req.get('host')+cdnPath, path: cdnPath, filename, size: req.file.buffer.length });
}));

router.metadata = [{
    name: 'File Upload', path: '/api/tools/fileupload', methods: ['GET','POST'], category: 'TOOLS',
    description: 'Upload file ke CDN. GET: kirim URL via param "url". POST: upload file langsung (field: file).',
    params: [
        { name:'url',      type:'text', required:false, placeholder:'https://example.com/foto.jpg', description:'URL file sumber (GET only)' },
        { name:'file',     type:'file', required:false, description:'File yang diupload langsung (POST only)' },
        { name:'filename', type:'text', required:false, placeholder:'namafile.jpg',                 description:'Nama file custom (opsional)' },
    ],
}];

module.exports = router;
