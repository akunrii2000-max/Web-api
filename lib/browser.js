'use strict';

/**
 * lib/browser.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Helper Puppeteer bersama (singleton browser + stealth).
 *
 * Kenapa perlu browser, bukan axios biasa?
 *   Beberapa sumber (TikTok web) memblokir request HTTP polos dari IP VPS
 *   (403 / halaman "Just a moment..."). Chrome asli + plugin stealth lolos.
 *
 * Pemakaian:
 *   const { withPage } = require('../lib/browser');
 *   const data = await withPage(async (page) => {
 *     await page.goto(url, { waitUntil: 'domcontentloaded' });
 *     return page.evaluate(() => document.title);
 *   });
 *
 * Browser di-launch sekali lalu dipakai ulang (hemat ±1.5 detik/request) dan
 * otomatis ditutup setelah idle BROWSER_IDLE_MS.
 *
 * ENV:
 *   PUPPETEER_EXECUTABLE_PATH = path chrome custom (opsional)
 *   BROWSER_IDLE_MS           = idle sebelum browser ditutup (default 180000)
 *   BROWSER_MAX_PAGES         = maksimum page paralel (default 3)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const IDLE_MS   = parseInt(process.env.BROWSER_IDLE_MS   || '180000', 10);
const MAX_PAGES = parseInt(process.env.BROWSER_MAX_PAGES || '3', 10);

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
  '--no-zygote',
  '--disable-background-networking',
  '--disable-features=IsolateOrigins,site-per-process',
  '--lang=en-US,en',
  '--window-size=1366,768',
];

let _browser    = null;
let _launching  = null;
let _idleTimer  = null;
let _active     = 0;   // page yang sedang dipakai
let _queue      = [];  // penunggu slot page

/* ─── Lifecycle ──────────────────────────────────────────────────────────── */

function _clearIdleTimer() {
  if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null; }
}

function _scheduleIdleClose() {
  _clearIdleTimer();
  if (_active > 0 || !_browser) return;
  _idleTimer = setTimeout(function() {
    _idleTimer = null;
    if (_active > 0 || !_browser) return;
    const b = _browser;
    _browser = null;
    b.close().then(
      function()  { console.log('[browser] ditutup (idle ' + (IDLE_MS / 1000) + 's)'); },
      function(e) { console.warn('[browser] gagal menutup:', e.message); }
    );
  }, IDLE_MS);
  if (_idleTimer.unref) _idleTimer.unref();
}

async function getBrowser() {
  if (_browser && _browser.connected !== false) return _browser;
  if (_launching) return _launching;

  _launching = puppeteer.launch({
    headless        : 'new',
    args            : LAUNCH_ARGS,
    executablePath  : process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    protocolTimeout : 120000,
  }).then(function(b) {
    _browser   = b;
    _launching = null;
    console.log('[browser] Chrome siap (pid ' + (b.process() ? b.process().pid : '?') + ')');
    b.on('disconnected', function() {
      if (_browser === b) _browser = null;
      console.warn('[browser] Chrome terputus.');
    });
    return b;
  }).catch(function(e) {
    _launching = null;
    console.error('[browser] gagal launch:', e.message);
    throw new Error('Browser tidak bisa dijalankan: ' + e.message);
  });

  return _launching;
}

/** Tutup browser secara manual (dipakai saat shutdown). */
async function closeBrowser() {
  _clearIdleTimer();
  const b = _browser;
  _browser = null;
  if (b) { try { await b.close(); } catch (e) {} }
}

/* ─── Slot page (batasi jumlah tab paralel) ──────────────────────────────── */

function _acquireSlot() {
  if (_active < MAX_PAGES) { _active++; return Promise.resolve(); }
  return new Promise(function(resolve) { _queue.push(resolve); });
}

function _releaseSlot() {
  const next = _queue.shift();
  if (next) return next();          // slot langsung dioper, _active tetap
  _active = Math.max(0, _active - 1);
  _scheduleIdleClose();
}

/* ─── API utama ──────────────────────────────────────────────────────────── */

/**
 * withPage(fn, opts)
 *   fn(page) → hasil apa pun; page otomatis ditutup setelahnya.
 *
 * opts:
 *   userAgent    : string        (default UA Chrome desktop)
 *   blockAssets  : boolean       (default true — blokir gambar/font/media/css)
 *   timeout      : ms navigasi   (default 60000)
 *   viewport     : { width, height }
 */
async function withPage(fn, opts) {
  const o = opts || {};
  await _acquireSlot();
  _clearIdleTimer();

  let page = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    await page.setUserAgent(o.userAgent || DEFAULT_UA);
    await page.setViewport(o.viewport || { width: 1366, height: 768 });
    await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });
    page.setDefaultNavigationTimeout(o.timeout || 60000);
    page.setDefaultTimeout(o.timeout || 60000);

    if (o.blockAssets !== false) {
      await page.setRequestInterception(true);
      page.on('request', function(req) {
        const type = req.resourceType();
        if (type === 'image' || type === 'font' || type === 'media' || type === 'stylesheet') {
          req.abort().catch(function() {});
        } else {
          req.continue().catch(function() {});
        }
      });
    }

    return await fn(page);

  } finally {
    if (page) { try { await page.close(); } catch (e) {} }
    _releaseSlot();
  }
}

module.exports = { getBrowser, withPage, closeBrowser, DEFAULT_UA };
