'use strict';

/**
 * lib/cdn-local.js
 * ─────────────────────────────────────────────────────────────────────────────
 * CDN backend LOKAL — file disimpan di disk, metadata di file JSON.
 * Pengganti cdn-external.js (DongtubeDB) — tanpa HTTP, tanpa API key.
 *
 * Layout:
 *   storage/cdn/<filename>        → file mentah
 *   data/cdn-index.json           → { "<filename>": { size, mime, uploadedAt } }
 *
 * Mode: LOCAL (serve dari disk)
 *   - Upload  → simpan buffer ke storage/cdn/
 *   - Return  → path relatif "/cdn/<filename>" (routes/cdn.js jadikan URL penuh)
 *   - GET /cdn/:filename → distream dari disk oleh routes/cdn.js via cdnFindFile()
 *
 * ENV:
 *   CDN_DIR       = folder file (default <root>/storage/cdn)
 *   CDN_INDEX     = file index JSON (default <root>/data/cdn-index.json)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const {
  CDN_ALLOWED_EXT, CDN_MIME, CDN_TEXT_EXTS, CDN_DOWNLOAD_EXTS, CDN_DANGEROUS_EXTS,
  CDN_MAX_FOLDERS, CDN_MAX_FILES_PER_FOLDER,
} = require('./cdn-mime');

/* ─── Config ─────────────────────────────────────────────────────────────── */

const ROOT      = path.join(__dirname, '..');
const CDN_DIR   = path.resolve(process.env.CDN_DIR   || path.join(ROOT, 'storage', 'cdn'));
const CDN_INDEX = path.resolve(process.env.CDN_INDEX || path.join(ROOT, 'data', 'cdn-index.json'));

try {
  fs.mkdirSync(CDN_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(CDN_INDEX), { recursive: true });
} catch (e) {
  console.error('[CDN-LOCAL] ❌ Gagal menyiapkan folder:', e.message);
}

/* ─── Index JSON (filename → metadata) ───────────────────────────────────── */

var _index = {};

function _loadIndex() {
  try {
    _index = JSON.parse(fs.readFileSync(CDN_INDEX, 'utf8')) || {};
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('[CDN-LOCAL] index rusak, mulai dari kosong:', e.message);
    _index = {};
  }
}

var _indexDirty  = false;
var _indexTimer  = null;

function _saveIndexNow() {
  _indexDirty = false;
  try {
    var tmp = CDN_INDEX + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(_index, null, 2));
    fs.renameSync(tmp, CDN_INDEX);
  } catch (e) {
    console.error('[CDN-LOCAL] gagal menulis index:', e.message);
  }
}

/** Tulis index dengan debounce kecil agar upload beruntun tidak spam disk. */
function _saveIndex() {
  _indexDirty = true;
  if (_indexTimer) return;
  _indexTimer = setTimeout(function() {
    _indexTimer = null;
    if (_indexDirty) _saveIndexNow();
  }, 200);
  if (_indexTimer.unref) _indexTimer.unref();
}

_loadIndex();

/**
 * Rekonsiliasi index dengan isi folder — file yang ada di disk tapi belum
 * tercatat (mis. disalin manual) tetap bisa dilayani & muncul di daftar.
 */
function _reconcileIndex() {
  var changed = false;
  var names;
  try { names = fs.readdirSync(CDN_DIR); } catch (e) { return; }

  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    if (name.indexOf('.tmp-') !== -1) continue;
    if (_index[name]) continue;
    try {
      var st = fs.statSync(path.join(CDN_DIR, name));
      if (!st.isFile()) continue;
      _index[name] = {
        size       : st.size,
        mime       : cdnGetMime(path.extname(name)),
        uploadedAt : st.mtime.toISOString(),
      };
      changed = true;
    } catch (e) {}
  }

  // Buang entri index yang filenya sudah tidak ada.
  for (var key of Object.keys(_index)) {
    if (!fs.existsSync(path.join(CDN_DIR, key))) { delete _index[key]; changed = true; }
  }

  if (changed) _saveIndexNow();
}

/* ─── Helper ─────────────────────────────────────────────────────────────── */

const FILENAME_RE = /^[a-zA-Z0-9\-_.]+$/;

function _safeFile(filename) {
  var name = String(filename || '');
  if (!name || name.length > 200 || !FILENAME_RE.test(name)) return null;
  if (name === '.' || name === '..' || name.indexOf('..') !== -1) return null;

  var full = path.resolve(CDN_DIR, name);
  if (!full.startsWith(CDN_DIR + path.sep)) return null;
  return full;
}

function cdnGetMime(ext) {
  var e    = String(ext || '').replace(/^\./, '').toLowerCase();
  var mime = CDN_MIME[e] || 'application/octet-stream';
  if (CDN_TEXT_EXTS.has(e)) mime += '; charset=utf-8';
  return mime;
}

function _cdnSanitizeError(err) {
  var msg = (err && err.message) || String(err);
  if (/ENOSPC|no space/i.test(msg))        return 'Storage server penuh, hubungi admin.';
  if (/EACCES|EPERM|permission/i.test(msg))return 'Server tidak bisa menulis file, hubungi admin.';
  if (/413|too large/i.test(msg))          return 'File terlalu besar.';
  if (/nama file|filename/i.test(msg))     return 'Nama file tidak valid.';
  return 'Upload gagal, coba lagi.';
}

/* ─── Core CDN functions ─────────────────────────────────────────────────── */

/**
 * Simpan file ke disk.
 * @returns {string} path relatif, contoh: "/cdn/ab12cd34.png"
 */
async function cdnUploadFile(filename, buffer) {
  var full = _safeFile(filename);
  if (!full) throw new Error('Nama file tidak valid: ' + filename);
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);

  var tmp = full + '.tmp-' + process.pid + '-' + crypto.randomBytes(4).toString('hex');
  try {
    fs.writeFileSync(tmp, buffer);
    fs.renameSync(tmp, full);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    console.error('[cdn-local] upload error:', filename, e.message);
    throw e;
  }

  _index[filename] = {
    size       : buffer.length,
    mime       : cdnGetMime(path.extname(filename)),
    uploadedAt : new Date().toISOString(),
  };
  _saveIndex();

  console.log('[cdn-local] uploaded:', filename,
    '|', (buffer.length / 1024 / 1024).toFixed(2) + 'MB');

  return '/cdn/' + filename;
}

/**
 * Cari file di disk — dipakai routes/cdn.js untuk streaming + Range request.
 * @returns {{filePath: string, size: number}|null}
 */
function cdnFindFile(filename) {
  var full = _safeFile(filename);
  if (!full) return null;
  try {
    var st = fs.statSync(full);
    if (!st.isFile()) return null;
    return { filePath: full, size: st.size };
  } catch (e) { return null; }
}

/**
 * Baca file sebagai Buffer (fallback bila streaming tidak dipakai).
 * @returns {Buffer|null}
 */
function cdnReadFile(filename) {
  var found = cdnFindFile(filename);
  if (!found) return null;
  try { return fs.readFileSync(found.filePath); } catch (e) { return null; }
}

/**
 * Hapus file dari disk.
 * @returns {boolean}
 */
async function cdnDeleteFile(filename) {
  var full = _safeFile(filename);
  if (!full) return false;
  try {
    fs.unlinkSync(full);
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('[cdn-local] delete error:', filename, e.message);
    if (_index[filename]) { delete _index[filename]; _saveIndex(); }
    return false;
  }
  delete _index[filename];
  _saveIndex();
  return true;
}

/**
 * Daftar semua file CDN.
 * @returns {Array<{name, url, size, path, folder, sha, download}>}
 */
async function cdnListFiles() {
  _reconcileIndex();
  return Object.keys(_index).map(function(name) {
    var rec  = _index[name] || {};
    var size = rec.size || 0;
    return {
      name    : name,
      url     : '/cdn/' + name,
      size    : size,
      path    : path.join(CDN_DIR, name),
      folder  : 'files',
      sha     : crypto.createHash('md5').update(name + size).digest('hex').slice(0, 8),
      download: '/cdn/' + name,
      uploadedAt: rec.uploadedAt || null,
    };
  }).sort(function(a, b) { return a.name.localeCompare(b.name); });
}

/**
 * Statistik storage.
 */
async function cdnStorageStats() {
  var files     = await cdnListFiles();
  var totalSize = files.reduce(function(s, f) { return s + (f.size || 0); }, 0);
  return {
    backend        : 'local-disk',
    dataDir        : CDN_DIR,
    totalFiles     : files.length,
    totalSizeBytes : totalSize,
    folders        : { files: { files: files.length, sizeBytes: totalSize } },
  };
}

/* ─── Helpers untuk routes/cdn.js ────────────────────────────────────────── */

var _cdnFolderCache = new Map();

function _cdnAccounts() {
  return [{ name: 'local-disk', backend: 'local-disk', active: true }];
}

function _cdnInvalidateCache() {
  _cdnFolderCache.clear();
  _loadIndex();
}

/* ─── Boot log ───────────────────────────────────────────────────────────── */

_reconcileIndex();

console.log('');
console.log('┌──────────────────────────────────────────────────────┐');
console.log('│  📦  Local Disk CDN                                  │');
console.log('│  📂  Dir  : ' + CDN_DIR.slice(0, 40).padEnd(40) + '│');
console.log('│  🗂️   Index: ' + path.basename(CDN_INDEX).padEnd(40) + '│');
console.log('│  📊  Files: ' + String(Object.keys(_index).length).padEnd(40) + '│');
console.log('│  🚀  Mode : Local — GET /cdn/:f distream dari disk   │');
console.log('└──────────────────────────────────────────────────────┘');
console.log('');

/* ─── Exports (interface sama dengan cdn-external.js) ────────────────────── */

module.exports = {
  _cdnAccounts, _cdnInvalidateCache, _cdnSanitizeError, _cdnFolderCache,
  cdnUploadFile, cdnReadFile, cdnFindFile,
  // null → routes/cdn.js memilih jalur streaming lokal, bukan redirect 302.
  cdnGetDirectUrl: null,
  cdnDeleteFile, cdnListFiles, cdnStorageStats,
  cdnGetMime,
  CDN_ALLOWED_EXT, CDN_MIME, CDN_TEXT_EXTS, CDN_DOWNLOAD_EXTS, CDN_DANGEROUS_EXTS,
  CDN_MAX_FOLDERS, CDN_MAX_FILES_PER_FOLDER,
  CDN_DIR, CDN_INDEX,
};
