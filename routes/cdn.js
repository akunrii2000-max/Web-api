'use strict';

const express = require('express');
const multer  = require('multer');
const axios   = require('axios');
const crypto  = require('crypto');
const fs      = require('fs');
const router  = express.Router();

const C        = require('../lib/config');
const { adminAuth, rateLimit } = require('../lib/auth');
const {
  _cdnAccounts, _cdnInvalidateCache, _cdnSanitizeError, _cdnFolderCache,
  cdnUploadFile, cdnReadFile, cdnGetDirectUrl, cdnFindFile,
  cdnDeleteFile, cdnListFiles, cdnStorageStats,
  cdnGetMime,
  CDN_ALLOWED_EXT,
  CDN_MAX_FOLDERS, CDN_MAX_FILES_PER_FOLDER,
} = require('../lib/cdn');
const { auditLog } = require('../lib/models');

const MAX_SIZE_MB = Math.max(parseInt(process.env.CDN_MAX_SIZE_MB || '100', 10), 100);
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const _multer = multer({
  storage: multer.memoryStorage(),
  limits : { fileSize: MAX_SIZE_BYTES },
});

router.post('/api/upload', function(req, res, next) {
  // CDN upload selalu public — tidak perlu auth apapun.
  _multer.single('file')(req, res, function(err) {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE')
      return res.status(400).json({ ok: false, message: 'File terlalu besar. Maksimum ' + MAX_SIZE_MB + 'MB.' });
    return res.status(400).json({ ok: false, message: 'Upload error: ' + err.message });
  });
}, async function(req, res) {
  try {
    const ip = req.ip || 'x';
    if (!rateLimit('cdn_up:' + ip, 20, 15 * 60 * 1000))
      return res.status(429).json({ ok: false, message: 'Terlalu banyak upload. Coba lagi nanti.' });

    var buffer, ext, originalName;
    const startTime = Date.now();

    if (req.file) {
      buffer = req.file.buffer;
      originalName = req.file.originalname || 'file';
      const dotIdx = originalName.lastIndexOf('.');
      ext = dotIdx >= 0 ? originalName.slice(dotIdx).toLowerCase() : '';

    } else if (req.body && req.body.url) {
      const targetUrl = String(req.body.url || '').trim();

      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))
        return res.json({ ok: false, message: 'URL tidak valid. Harus dimulai dengan http/https.' });

      const _ssrfBlock = /^https?:\/\/(?:localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|0\.0\.0\.0|0177\.|2130706433|100\.64\.|100\.65\.|\[::1\]|\[::ffff:|\[fc[0-9a-f]{0,2}:|\[fd[0-9a-f]{0,2}:|::1|metadata\.google\.internal|metadata\.)/i;
      if (_ssrfBlock.test(targetUrl))
        return res.json({ ok: false, message: 'URL tidak diizinkan.' });

      if (!rateLimit('cdn_url:' + ip, 10, 15 * 60 * 1000))
        return res.status(429).json({ ok: false, message: 'Terlalu banyak request.' });

      const urlRes = await axios.get(targetUrl, {
        responseType: 'arraybuffer', timeout: 15000,
        maxContentLength: MAX_SIZE_BYTES, maxRedirects: 3,
      });

      if (!urlRes.data || urlRes.data.byteLength === 0)
        return res.json({ ok: false, message: 'URL tidak mengandung data file.' });

      buffer = Buffer.from(urlRes.data);
      const urlPath = targetUrl.split('?')[0].split('/').pop() || 'file';
      const dotIdx2 = urlPath.lastIndexOf('.');
      ext = dotIdx2 >= 0 ? urlPath.slice(dotIdx2).toLowerCase() : '';
      originalName = urlPath;

    } else {
      return res.json({ ok: false, message: 'File atau URL diperlukan.' });
    }

    if (buffer.length > MAX_SIZE_BYTES)
      return res.json({ ok: false, message: 'Ukuran file terlalu besar. Maksimal ' + MAX_SIZE_MB + 'MB.' });

    if (!ext || !CDN_ALLOWED_EXT.test(ext)) ext = '.bin';

    var filename;
    const rawSlug = String(req.body.slug || req.body.name || '').trim();
    if (rawSlug) {
      const slug = rawSlug
        .replace(/[^a-zA-Z0-9\-_.]/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^[-.]|[-.]$/g, '')
        .slice(0, 80);
      if (!slug) return res.json({ ok: false, message: 'Nama file tidak valid.' });
      const slugHasExt = /\.[a-z0-9]{1,6}$/i.test(slug);
      filename = slugHasExt ? slug : slug + ext;
    } else {
      filename = crypto.randomBytes(8).toString('hex') + ext;
    }

    var url;
    try { url = await cdnUploadFile(filename, buffer); }
    catch(uploadErr) { return res.json({ ok: false, message: _cdnSanitizeError(uploadErr) }); }

    // Jika url sudah absolute (mode external → dongtube URL langsung), pakai as-is
    const fullUrl  = /^https?:\/\//i.test(url)
      ? url
      : (req.protocol + '://' + req.get('host') + url);
    const sizeMB   = (buffer.length / 1024 / 1024).toFixed(2);
    const timeSec  = ((Date.now() - startTime) / 1000).toFixed(2);

    res.json({
      ok        : true,
      url       : fullUrl,
      path      : url,
      filename,
      size      : buffer.length,
      sizeMB    : parseFloat(sizeMB),
      uploadTime: parseFloat(timeSec),
    });

  } catch(e) {
    console.error('[cdn/upload]', e.message);
    res.json({ ok: false, message: _cdnSanitizeError(e) });
  }
});

router.get('/cdn/:filename', async function(req, res) {
  try {
    const filename = req.params.filename;

    if (!filename || filename.length > 200 || !/^[a-zA-Z0-9\-_.]+$/.test(filename))
      return res.status(404).send('Not found');

    // Mode external: redirect 302 langsung ke dongtube
    if (typeof cdnGetDirectUrl === 'function') {
      const directUrl = await cdnGetDirectUrl(filename);
      if (directUrl) {
        res.set('Cache-Control', 'public, max-age=86400');
        return res.redirect(302, directUrl);
      }
      return res.status(404).send('File not found');
    }

    // Mode local: stream langsung dari disk
    if (typeof cdnFindFile === 'function') {
      const found = cdnFindFile(filename);
      if (!found) return res.status(404).send('File not found');

      let stat;
      try { stat = fs.statSync(found.filePath); } catch(e) { return res.status(404).send('File not found'); }

      const ext  = filename.split('.').pop().toLowerCase();
      const mime = cdnGetMime('.' + ext);

      res.set('Content-Type', mime);
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('Accept-Ranges', 'bytes');
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Content-Disposition', 'inline; filename="' + filename + '"');

      const totalSize   = stat.size;
      const rangeHeader = req.headers['range'];

      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
        const start = match && match[1] !== '' ? parseInt(match[1], 10) : 0;
        const end   = match && match[2] !== '' ? parseInt(match[2], 10) : totalSize - 1;
        if (start > end || start >= totalSize) {
          res.set('Content-Range', 'bytes */' + totalSize);
          return res.status(416).send('Range Not Satisfiable');
        }
        res.set('Content-Range', 'bytes ' + start + '-' + end + '/' + totalSize);
        res.set('Content-Length', (end - start) + 1);
        res.status(206);
        return fs.createReadStream(found.filePath, { start, end }).pipe(res);
      }

      res.set('Content-Length', totalSize);
      return fs.createReadStream(found.filePath).pipe(res);
    }

    // Fallback buffer (jika cdnFindFile tidak tersedia)
    const buf = cdnReadFile(filename);
    if (!buf) return res.status(404).send('File not found');

    const ext  = filename.split('.').pop().toLowerCase();
    const mime = cdnGetMime('.' + ext);

    res.set('Content-Type', mime);
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Accept-Ranges', 'bytes');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Disposition', 'inline; filename="' + filename + '"');

    const rangeHeader = req.headers['range'];
    if (rangeHeader) {
      const totalSize = buf.length;
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      const start = match && match[1] !== '' ? parseInt(match[1], 10) : 0;
      const end   = match && match[2] !== '' ? parseInt(match[2], 10) : totalSize - 1;
      if (start > end || start >= totalSize) {
        res.set('Content-Range', 'bytes */' + totalSize);
        return res.status(416).send('Range Not Satisfiable');
      }
      res.set('Content-Range', 'bytes ' + start + '-' + end + '/' + totalSize);
      res.set('Content-Length', (end - start) + 1);
      return res.status(206).send(buf.slice(start, end + 1));
    }
    res.set('Content-Length', buf.length);
    res.send(buf);

  } catch(e) {
    console.error('[cdn/get]', e.message);
    res.status(500).send('Error');
  }
});

router.get('/api/admin/cdn/status', adminAuth, async function(req, res) {
  try {
    var stats = await cdnStorageStats();
    res.json({
      ok              : true,
      backend         : stats.backend || 'local',
      configured      : true,
      dataDir         : stats.dataDir,
      totalFiles      : stats.totalFiles,
      totalSizeBytes  : stats.totalSizeBytes,
      folders         : stats.folders,
      maxFilesPerFolder: CDN_MAX_FILES_PER_FOLDER,
      maxFolders      : CDN_MAX_FOLDERS,
      folderCacheSize : _cdnFolderCache.size,
    });
  } catch(e) { res.json({ ok: false, message: 'Terjadi kesalahan, coba lagi.' }); }
});

router.get('/api/admin/cdn/files', adminAuth, async function(req, res) {
  try {
    var files = await cdnListFiles();
    res.json({ ok: true, total: files.length, data: files });
  } catch(e) { res.json({ ok: false, message: 'Terjadi kesalahan, coba lagi.' }); }
});

router.delete('/api/admin/cdn/files/:filename', adminAuth, async function(req, res) {
  try {
    var filename = req.params.filename;
    if (!filename || !/^[a-zA-Z0-9\-_.]+$/.test(filename))
      return res.json({ ok: false, message: 'Nama file tidak valid.' });

    var deleted = await cdnDeleteFile(filename);
    if (!deleted) return res.json({ ok: false, message: 'File tidak ditemukan di CDN.' });

    auditLog('cdn-delete', filename, req.adminIp).catch(function(){});
    res.json({ ok: true });
  } catch(e) { res.json({ ok: false, message: _cdnSanitizeError(e) }); }
});

router.post('/api/admin/cdn/invalidate-cache', adminAuth, function(req, res) {
  var before = _cdnFolderCache.size;
  _cdnFolderCache.clear();
  res.json({ ok: true, cleared: before });
});

module.exports = router;
