'use strict';

/**
 * db-local.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Backend database berbasis FILE JSON LOKAL. Pengganti db-external.js
 * (DongtubeDB / dongtube.my.id) — tidak ada HTTP, tidak ada API key.
 *
 * Interface-nya identik dengan db-external.js sehingga lib/models.js tidak
 * perlu diubah sama sekali.
 *
 * Layout penyimpanan (DATA_DIR, default: <root>/data):
 *   data/products.json
 *   data/settings.json
 *   data/users/alice.json
 *   data/transactions/TRX123.json
 *   ...
 * Key KV "users/alice.json" → file "<DATA_DIR>/users/alice.json".
 *
 * ENV:
 *   DATA_DIR = path folder data (opsional, default <root>/data)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

/* ─── Config ─────────────────────────────────────────────────────────────── */

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));

try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {
  console.error('[DB-LOCAL] ❌ Gagal membuat DATA_DIR:', DATA_DIR, e.message);
}

/* ─── Path helper — cegah path traversal ─────────────────────────────────── */

function _safePath(fp) {
  var key = String(fp || '').replace(/^\/+/, '');
  if (!key) throw new Error('[DB-LOCAL] key kosong');
  if (key.split('/').some(function(seg) { return seg === '..' || seg === '.'; }))
    throw new Error('[DB-LOCAL] key tidak valid: ' + fp);

  var full = path.resolve(DATA_DIR, key);
  if (full !== DATA_DIR && !full.startsWith(DATA_DIR + path.sep))
    throw new Error('[DB-LOCAL] key di luar DATA_DIR: ' + fp);
  return full;
}

function _sha(raw) {
  return crypto.createHash('sha1').update(raw).digest('hex');
}

/* ─── Antrian tulis per-file (serialisasi write dalam 1 proses) ──────────── */

var _writeQueue = new Map();

function _withLock(fp, fn) {
  var prev = _writeQueue.get(fp) || Promise.resolve();
  var next = prev.then(fn, fn);
  // Tail antrian tidak boleh membawa rejection (nanti unhandled) — dibungkus catch.
  var tail = next.catch(function() {});
  _writeQueue.set(fp, tail);
  // Bersihkan entri jika tidak ada write lain yang menyusul, supaya Map tidak
  // tumbuh tanpa batas untuk key sekali-pakai (transaksi, order, dst).
  tail.then(function() {
    if (_writeQueue.get(fp) === tail) _writeQueue.delete(fp);
  });
  return next;
}

/* ─── Core KV operations ─────────────────────────────────────────────────── */

/**
 * dbRead(fp)
 * → { data: <value|null>, sha: <string|null> }
 *
 * Catatan: backend lokal membaca langsung dari disk (murah), jadi tidak ada
 * cache — parameter bypassCache diabaikan dan hasil selalu fresh.
 */
async function dbRead(fp, _bypassCache) {
  var full;
  try { full = _safePath(fp); }
  catch (e) { console.error('[DB-LOCAL] dbRead:', e.message); return { data: null, sha: null }; }

  var raw;
  try {
    raw = fs.readFileSync(full, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('[DB-LOCAL] dbRead error:', fp, e.message);
    return { data: null, sha: null };
  }

  try {
    return { data: JSON.parse(raw), sha: _sha(raw) };
  } catch (e) {
    console.error('[DB-LOCAL] dbRead JSON rusak:', fp, e.message);
    return { data: null, sha: null };
  }
}

/**
 * dbWrite(fp, data, sha?, msg?)
 * Optimistic locking: jika `sha` diisi dan tidak cocok dengan isi file saat ini,
 * lempar error { status: 409 } — sama persis dengan perilaku db-external.
 * Tulis bersifat atomik (tmp file + rename).
 */
async function dbWrite(fp, data, sha, _msg) {
  var full = _safePath(fp);

  return _withLock(full, function() {
    var raw = JSON.stringify(data, null, 2);

    if (sha !== null && sha !== undefined) {
      var current = null;
      try { current = _sha(fs.readFileSync(full, 'utf8')); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }

      if (current !== sha) {
        throw Object.assign(
          new Error('SHA conflict — data sudah diubah oleh proses lain'),
          { status: 409 }
        );
      }
    }

    fs.mkdirSync(path.dirname(full), { recursive: true });

    var tmp = full + '.tmp-' + process.pid + '-' + crypto.randomBytes(4).toString('hex');
    try {
      fs.writeFileSync(tmp, raw);
      fs.renameSync(tmp, full);
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch (_) {}
      console.error('[DB-LOCAL] dbWrite error:', fp, e.message);
      throw e;
    }
  });
}

/**
 * dbDelete(fp)
 */
async function dbDelete(fp) {
  var full;
  try { full = _safePath(fp); }
  catch (e) { console.error('[DB-LOCAL] dbDelete:', e.message); return; }

  return _withLock(full, function() {
    try { fs.unlinkSync(full); }
    catch (e) { if (e.code !== 'ENOENT') console.error('[DB-LOCAL] dbDelete error:', fp, e.message); }
  });
}

/**
 * listDirCached(folderPath)
 * → [{ name, sha, type }]  (hanya file di level folder tersebut)
 */
async function listDirCached(folderPath) {
  var full;
  try { full = _safePath(folderPath); }
  catch (e) { console.error('[DB-LOCAL] listDir:', e.message); return []; }

  var entries;
  try {
    entries = fs.readdirSync(full, { withFileTypes: true });
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('[DB-LOCAL] listDirCached error:', folderPath, e.message);
    return [];
  }

  var out = [];
  for (var i = 0; i < entries.length; i++) {
    var ent = entries[i];
    if (!ent.isFile()) continue;
    if (ent.name.indexOf('.tmp-') !== -1) continue; // file sementara dari dbWrite

    var sha = null;
    try { sha = _sha(fs.readFileSync(path.join(full, ent.name), 'utf8')); } catch (_) {}
    out.push({ name: ent.name, sha: sha, type: 'file' });
  }
  return out;
}

/* ─── Rate limiter — in-memory (sama dengan db-external) ────────────────── */

var _rlMap = new Map();

async function rateLimitDB(key, maxHits, windowMs) {
  var now   = Date.now();
  var entry = _rlMap.get(key) || { hits: [] };
  entry.hits = entry.hits.filter(function(ts) { return ts > now - windowMs; });
  entry.hits.push(now);
  _rlMap.set(key, entry);
  return entry.hits.length <= maxHits;
}

/* ─── OTP lock — in-memory mutex ─────────────────────────────────────────── */

var _otpLocks    = new Map();
var OTP_LOCK_TTL = 7000;

async function _acquireOtpLockDB(username) {
  var now      = Date.now();
  var existing = _otpLocks.get(username);
  if (existing && existing.expiresAt > now) {
    throw Object.assign(
      new Error('User sedang memproses order lain. Tunggu sebentar.'),
      { status: 429 }
    );
  }
  _otpLocks.set(username, { lockedAt: now, expiresAt: now + OTP_LOCK_TTL });
  return username;
}

async function _releaseOtpLockDB(lockHandle) {
  if (lockHandle) _otpLocks.delete(lockHandle);
}

/* ─── Stub backward-compat (tidak dipakai di mode jsonfile) ─────────────── */

var _db     = { query: function() { return []; }, pager: { flush: function() {} }, close: function() {} };
var esc     = function(v) { return JSON.stringify(v); };
var q       = function() { return null; };
var qSelect = function() { return []; };

/* ─── Cache stub (dipertahankan agar interface sama) ─────────────────────── */

var _gitTreeCache = new Map();
function _dbCacheInvalidate() { /* no-op: backend lokal tidak memakai cache */ }

function _saveAllData(signal) {
  console.log('[db-local] _saveAllData (' + (signal || 'unknown') + ') — no-op, setiap write sudah langsung ke disk.');
}

/* ─── Boot log ───────────────────────────────────────────────────────────── */

var DB_BACKEND = 'local-jsonfile';

console.log('');
console.log('┌──────────────────────────────────────────────────────┐');
console.log('│  💾  Local JSON File Database                        │');
console.log('│  📂  Dir  : ' + DATA_DIR.slice(0, 40).padEnd(40) + '│');
console.log('│  🔒  Lock : optimistic SHA-1 + atomic rename         │');
console.log('│  ⚡  Cache: none (baca langsung dari disk)            │');
console.log('└──────────────────────────────────────────────────────┘');
console.log('');

/* ─── Exports (interface identik dengan db-external.js) ─────────────────── */

module.exports = {
  DB_BACKEND,
  DATA_DIR,
  _dbCacheInvalidate,
  _gitTreeCache,
  dbRead, dbWrite, dbDelete, listDirCached,
  rateLimitDB,
  _acquireOtpLockDB, _releaseOtpLockDB,
  _db, esc, q, qSelect,
  _saveAllData,
};
