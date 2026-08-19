'use strict';

require('dotenv').config();

const express = require('express');
const path    = require('path');
const fs      = require('fs');

const {
  setupCompression,
  setupCors,
  setupBodyParsers,
  setupSecurityHeaders,
} = require('./lib/middleware');

const { apikeyRequired } = require('./lib/apikeyAuth');

const C = require('./lib/config');

function loadEndpointRouters(dir) {
  const routers = [];
  const _baseDir = path.resolve(dir);
  if (!fs.existsSync(_baseDir)) return routers;

  function _walk(current) {
    const resolved = path.resolve(current);
    if (!resolved.startsWith(_baseDir)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        _walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        try {
          const router = require(fullPath);
          routers.push(router);
        } catch (e) {
          console.error('[autoload] Failed to load', fullPath, ':', e.message);
        }
      }
    }
  }

  _walk(_baseDir);
  return routers;
}

const cdnRouter       = require('./routes/cdn');
const endpointRouters = loadEndpointRouters(path.join(__dirname, 'routes', 'endpoints'));


const app = express();

app.set('trust proxy', 1);
setupCompression(app);
setupCors(app);
setupBodyParsers(app);
setupSecurityHeaders(app);

app.use(function(req, res, next) {
  res.setTimeout(120000, function() {
    if (!res.headersSent) res.status(503).json({ ok: false, message: 'Request timeout.' });
  });
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
try { app.use(express.static(path.resolve('/var/task/public'))); } catch(e){}

// ── CDN ───────────────────────────────────────────────────────────────────────
app.use(cdnRouter);

// ── /api/endpoints — public, no auth required ─────────────────────────────────
app.get('/api/endpoints', function(req, res) {
  var list = [];
  endpointRouters.forEach(function(r) {
    if (!r.metadata) return;
    if (Array.isArray(r.metadata)) {
      r.metadata.forEach(function(m) { list.push(m); });
    } else {
      list.push(r.metadata);
    }
  });
  var grouped = {};
  list.forEach(function(ep) {
    var cat = (ep.category || 'OTHER').toUpperCase();
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(ep);
  });
  res.json({ ok: true, total: list.length, categories: grouped });
});

// ── API Key Auth — wajib untuk semua /api/* ───────────────────────────────────
app.use('/api', apikeyRequired);

// ── Endpoint routers (auto-loaded) ────────────────────────────────────────────
endpointRouters.forEach(function(router) { app.use('/', router); });

// ── Docs ──────────────────────────────────────────────────────────────────────
function sendDocs(res) {
  const publicDir = path.resolve(__dirname, 'public');
  const candidates = [
    path.resolve(publicDir, 'docs.html'),
    path.resolve(process.cwd(), 'public', 'docs.html'),
    path.resolve('/var/task/public', 'docs.html'),
  ];
  function tryNext(i) {
    if (i >= candidates.length) return res.status(404).send('Page not found');
    res.sendFile(candidates[i], function(err) { if (err) tryNext(i + 1); });
  }
  tryNext(0);
}

app.get('/',         function(_, res) { res.sendFile(path.resolve(__dirname, 'public', 'index.html')); });
app.get('/api-docs', function(_, res) { res.redirect(301, '/docs'); });
app.get('/docs',     function(_, res) { sendDocs(res); });

// ── 404 & error handler ───────────────────────────────────────────────────────
app.use(function(req, res) {
  res.status(404).json({ ok: false, message: 'Not found.' });
});

app.use(function(err, req, res, next) {
  console.error('[unhandled-error]', req.method, req.path, err.message);
  if (res.headersSent) return;
  res.status(err.status || 500).json({ ok: false, message: err.message || 'Terjadi kesalahan internal.' });
});

// ── Start server ──────────────────────────────────────────────────────────────
if (require.main === module) {
  const server = app.listen(C.port, function() {
    console.log('✅  Server aktif | http://localhost:' + C.port);
    console.log('📄  Docs         | http://localhost:' + C.port + '/docs');
  });

  process.on('uncaughtException', function(err) {
    console.error('[CRASH PREVENTED] uncaughtException:', err.message);
  });
  process.on('unhandledRejection', function(reason) {
    console.error('[CRASH PREVENTED] unhandledRejection:', reason && reason.message ? reason.message : String(reason));
  });

  function _gracefulShutdown(signal) {
    console.log('[shutdown] ' + signal + ' — menutup server...');
    try { require('./lib/browser').closeBrowser(); } catch(e) {}
    server.close(function() {
      console.log('[shutdown] HTTP server ditutup.');
      process.exit(0);
    });
    setTimeout(function() { process.exit(1); }, 10000);
  }
  process.on('SIGTERM', function() { _gracefulShutdown('SIGTERM'); });
  process.on('SIGINT',  function() { _gracefulShutdown('SIGINT'); });
}

module.exports = app;
