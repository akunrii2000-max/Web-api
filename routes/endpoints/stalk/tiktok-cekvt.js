'use strict';

/**
 * TikTok Cek Video (cekvt)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ambil video TERBARU dari sebuah akun TikTok beserta statistiknya.
 *
 * Cara kerja (2 tahap):
 *   1. Halaman embed  https://www.tiktok.com/embed/@user  → daftar video terbaru
 *      + info profil. Halaman ini tidak dijaga Cloudflare, jadi cukup axios.
 *      Dari sini kita dapat playAddr (URL .mp4 langsung, bisa diputar tanpa
 *      cookie/referer — cocok dikirim bot WhatsApp).
 *   2. Halaman detail https://www.tiktok.com/@user/video/<id> DIBUKA PAKAI
 *      PUPPETEER (Chrome asli + stealth). Request HTTP polos dari IP VPS kena
 *      403 "Just a moment...", browser asli lolos. Dari sini kita dapat durasi,
 *      waktu upload, dan statistik lengkap (views/likes/komentar/share).
 *
 * Jika tahap 2 gagal, response tetap dikembalikan memakai data tahap 1
 * (field `detail_ok: false`) — waktu upload direkonstruksi dari video ID.
 *
 * PENTING: daftar dari embed menaruh video yang DISEMATKAN di paling atas, jadi
 * item pertama belum tentu postingan terbaru. Lihat markAndSortVideos().
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Router } = require('express');
const axios      = require('axios');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');
const { withPage, DEFAULT_UA } = require('../../../lib/browser');

const router = Router();

const EMBED_TIMEOUT = 20000;
const MAX_COUNT     = 3;

/* ─── Helper format ──────────────────────────────────────────────────────── */

function formatNumber(num) {
  const n = Number(num);
  if (!n || isNaN(n)) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function formatDuration(seconds) {
  const s    = Math.max(0, parseInt(seconds, 10) || 0);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return mins + ':' + String(secs).padStart(2, '0');
}

function formatDate(unixSeconds) {
  if (!unixSeconds) return 'Tidak diketahui';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
    }).format(new Date(unixSeconds * 1000)) + ' WIB';
  } catch (e) {
    return 'Tidak diketahui';
  }
}

/** TikTok menyimpan timestamp upload di 32 bit teratas video ID. */
function timestampFromId(id) {
  try {
    const t = Number(BigInt(String(id)) >> 32n);
    return (t > 1000000000 && t < 4000000000) ? t : null;
  } catch (e) { return null; }
}

/**
 * TikTok menaruh video yang DISEMATKAN (pin, maks 3) di awal daftar; setelah itu
 * daftar urut dari terbaru ke terlama. Karena video sematan bisa video lama,
 * index 0 BUKAN selalu postingan terbaru. Jadi:
 *   - deretan kronologis = suffix terpanjang yang urutannya menurun,
 *   - sisa di depannya = video sematan,
 *   - lalu semuanya diurutkan ulang berdasarkan waktu upload (terbaru dulu).
 * Kalau video sematan memang postingan terbaru, ia tetap keluar di urutan pertama.
 */
function markAndSortVideos(videos) {
  const ts = videos.map((v) => timestampFromId(v.id) || 0);

  let firstChrono = videos.length ? videos.length - 1 : 0;
  while (firstChrono > 0 && ts[firstChrono - 1] > ts[firstChrono]) firstChrono--;

  return videos
    .map((v, i) => ({ video: v, ts: ts[i], index: i, pinned: i < firstChrono }))
    // Terbaru dulu; kalau timestamp tidak terbaca (0) pakai urutan asli TikTok.
    .sort((a, b) => (b.ts - a.ts) || (a.index - b.index));
}

function cleanUsername(raw) {
  let u = String(raw || '').trim();
  // Terima juga URL profil / URL video: https://www.tiktok.com/@user/video/123
  const m = u.match(/tiktok\.com\/@([A-Za-z0-9._]+)/i);
  if (m) u = m[1];
  u = u.replace(/^@+/, '').split(/[/?#]/)[0].trim();
  if (!u) throw new ValidationError('Username tidak boleh kosong.', 400);
  if (!/^[A-Za-z0-9._]{1,24}$/.test(u))
    throw new ValidationError('Username TikTok tidak valid: ' + u, 400);
  return u;
}

/* ─── Tahap 1: halaman embed (axios) ─────────────────────────────────────── */

async function fetchEmbedProfile(username) {
  let html;
  try {
    const res = await axios.get('https://www.tiktok.com/embed/@' + encodeURIComponent(username), {
      headers: {
        'User-Agent'     : DEFAULT_UA,
        'accept'         : 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
        'referer'        : 'https://www.tiktok.com/',
      },
      timeout       : EMBED_TIMEOUT,
      validateStatus: (s) => s < 500,
    });
    // TikTok membalas 400/404 untuk username yang tidak ada.
    if (res.status === 404 || res.status === 400)
      throw new ValidationError('Akun @' + username + ' tidak ditemukan.', 404);
    if (res.status !== 200) throw new ValidationError('TikTok membalas status ' + res.status + '.', 502);
    html = res.data;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError('Gagal menghubungi TikTok: ' + err.message, 502);
  }

  const m = String(html).match(/<script id="__FRONTITY_CONNECT_STATE__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new ValidationError('Struktur halaman TikTok berubah, data tidak bisa dibaca.', 502);

  let state;
  try { state = JSON.parse(m[1]); }
  catch (e) { throw new ValidationError('Data TikTok tidak bisa di-parse.', 502); }

  const bucket = (state.source && state.source.data) || {};
  const key    = Object.keys(bucket)
    .find((k) => k.toLowerCase() === ('/embed/@' + username).toLowerCase()) || Object.keys(bucket)[0];
  const data   = key ? bucket[key] : null;

  if (!data || !data.userInfo || !data.userInfo.uniqueId)
    throw new ValidationError('Akun @' + username + ' tidak ditemukan atau disembunyikan.', 404);

  return {
    user  : data.userInfo,
    videos: Array.isArray(data.videoList) ? data.videoList : [],
  };
}

/* ─── Tahap 2: halaman detail video (puppeteer) ──────────────────────────── */

function _extractDetail() {
  const el = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
  if (!el) return null;
  let scope;
  try { scope = (JSON.parse(el.textContent) || {}).__DEFAULT_SCOPE__ || {}; }
  catch (e) { return null; }

  const vd = scope['webapp.video-detail'];
  if (!vd) return null;
  const it = vd.itemInfo && vd.itemInfo.itemStruct;
  if (!it) return { blocked: true, statusMsg: vd.statusMsg || null };

  const st = it.statsV2 || it.stats || {};
  return {
    id         : it.id,
    desc       : it.desc || '',
    createTime : Number(it.createTime) || null,
    duration   : (it.video && it.video.duration) || 0,
    cover      : (it.video && it.video.cover) || '',
    playAddr   : (it.video && it.video.playAddr) || '',
    author     : {
      uniqueId : it.author && it.author.uniqueId,
      nickname : it.author && it.author.nickname,
      avatar   : it.author && it.author.avatarLarger,
      verified : !!(it.author && it.author.verified),
    },
    music      : it.music ? { title: it.music.title || '', author: it.music.authorName || '' } : null,
    stats      : {
      play_count   : Number(st.playCount)    || 0,
      digg_count   : Number(st.diggCount)    || 0,
      comment_count: Number(st.commentCount) || 0,
      share_count  : Number(st.shareCount)   || 0,
      collect_count: Number(st.collectCount) || 0,
      repost_count : Number(st.repostCount)  || 0,
    },
  };
}

async function fetchVideoDetail(username, videoId) {
  const url = 'https://www.tiktok.com/@' + username + '/video/' + videoId;
  try {
    return await withPage(async function(page) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      for (let i = 0; i < 5; i++) {
        const out = await page.evaluate(_extractDetail).catch(function() { return null; });
        if (out && !out.blocked) return out;
        if (out && out.blocked) {
          console.warn('[cekvt] video-detail diblokir:', videoId, out.statusMsg || '');
          return null;
        }
        await new Promise(function(r) { setTimeout(r, 1500); });
      }
      return null;
    }, { timeout: 60000 });
  } catch (e) {
    console.warn('[cekvt] fetchVideoDetail gagal:', videoId, e.message);
    return null;
  }
}

/* ─── Penggabungan + caption ─────────────────────────────────────────────── */

function buildVideo(username, embedVideo, detail, meta) {
  const info      = meta || {};
  const id        = embedVideo.id;
  const created   = (detail && detail.createTime) || timestampFromId(id);
  const desc      = (detail && detail.desc) || embedVideo.desc || '';
  const stats     = (detail && detail.stats) || {
    play_count   : Number(embedVideo.playCount) || 0,
    digg_count   : 0, comment_count: 0, share_count: 0, collect_count: 0, repost_count: 0,
  };
  const duration  = (detail && detail.duration) || 0;

  return {
    video_id   : id,
    url        : 'https://www.tiktok.com/@' + username + '/video/' + id,
    title      : desc,
    description: desc,
    duration   : duration,
    duration_text: formatDuration(duration),
    created_at : created ? new Date(created * 1000).toISOString() : null,
    created_timestamp: created || null,
    created_text: formatDate(created),
    // playAddr dari halaman embed: .mp4 langsung, tanpa watermark, bisa diakses
    // tanpa cookie/referer (aman dipakai bot WhatsApp / <video src>).
    play       : embedVideo.playAddr || (detail && detail.playAddr) || '',
    cover      : embedVideo.coverUrl || (detail && detail.cover) || '',
    origin_cover : embedVideo.originCoverUrl  || '',
    dynamic_cover: embedVideo.dynamicCoverUrl || '',
    width      : embedVideo.width  || null,
    height     : embedVideo.height || null,
    ratio      : embedVideo.ratio  || null,
    private    : !!embedVideo.privateItem,
    // true = video ini DISEMATKAN di profil (posisinya di atas walau bukan terbaru).
    pinned     : !!info.pinned,
    music      : (detail && detail.music) || null,
    stats      : stats,
    stats_text : {
      play_count   : formatNumber(stats.play_count),
      digg_count   : formatNumber(stats.digg_count),
      comment_count: formatNumber(stats.comment_count),
      share_count  : formatNumber(stats.share_count),
      collect_count: formatNumber(stats.collect_count),
    },
    detail_ok  : !!detail,
  };
}

/** Caption siap pakai (format sama dengan command .cekvt di bot). */
function buildCaption(username, user, v, botname) {
  const capText = (v.title || 'Tidak ada deskripsi');
  return (
`✦ 𝗧𝗶𝗸𝗧𝗼𝗸 𝗟𝗮𝘁𝗲𝘀𝘁 𝗩𝗶𝗱𝗲𝗼 ✦

 ── 𝗔𝗰𝗰𝗼𝘂𝗻𝘁 ──
 ➤ 𝗨𝘀𝗲𝗿𝗻𝗮𝗺𝗲 : @${username}
 ➤ 𝗡𝗶𝗰𝗸𝗻𝗮𝗺𝗲 : ${user.nickname || 'Tidak diketahui'}
 ➤ 𝗩𝗶𝗱𝗲𝗼 𝗜𝗗 : ${v.video_id || '-'}

 ── 𝗖𝗮𝗽𝘁𝗶𝗼𝗻 ──
 ${capText.substring(0, 120)}${capText.length > 120 ? '...' : ''}

 ── 𝗗𝗲𝘁𝗮𝗶𝗹 ──
 ➤ 𝗗𝘂𝗿𝗮𝘀𝗶 : ${v.duration_text}
 ➤ 𝗗𝗶𝗽𝗼𝘀𝘁𝗶𝗻𝗴 : ${v.created_text}

 ── 𝗦𝘁𝗮𝘁𝗶𝘀𝘁𝗶𝗸 ──
 ➤ 𝗧𝗮𝘆𝗮𝗻𝗴𝗮𝗻 : ${v.stats_text.play_count}
 ➤ 𝗦𝘂𝗸𝗮 : ${v.stats_text.digg_count}
 ➤ 𝗞𝗼𝗺𝗲𝗻𝘁𝗮𝗿 : ${v.stats_text.comment_count}
 ➤ 𝗕𝗮𝗴𝗶𝗸𝗮𝗻 : ${v.stats_text.share_count}

 ── 𝗟𝗶𝗻𝗸 ──
 ➤ ${v.url}

 ✦ ${botname} • TikTok Watcher ✦`
  );
}

/* ─── Handler utama ──────────────────────────────────────────────────────── */

async function cekVideoTiktok(rawUsername, opts) {
  const o        = opts || {};
  const username = cleanUsername(rawUsername);

  const count = Math.min(Math.max(parseInt(o.count, 10) || 1, 1), MAX_COUNT);
  const wantDetail = String(o.detail === undefined ? 'true' : o.detail) !== 'false';
  // skip_pinned=true → video sematan dibuang total, hanya postingan biasa dipakai.
  const skipPinned = String(o.skip_pinned || o.skipPinned || 'false') === 'true';

  const { user, videos } = await fetchEmbedProfile(username);

  if (!videos.length) {
    throw new ValidationError(
      'Tidak ada video ditemukan untuk @' + username + '. Akun mungkin privat atau belum posting.',
      404
    );
  }

  let sorted = markAndSortVideos(videos);
  const pinnedCount = sorted.filter(function(x) { return x.pinned; }).length;

  if (skipPinned) {
    const unpinned = sorted.filter(function(x) { return !x.pinned; });
    if (!unpinned.length)
      throw new ValidationError('@' + username + ' hanya punya video yang disematkan.', 404);
    sorted = unpinned;
  }

  const picked = sorted.slice(0, count);
  const out    = [];

  for (const item of picked) {
    // Sekuensial: tiap detail buka 1 tab Chrome, jangan dihajar paralel.
    const detail = wantDetail ? await fetchVideoDetail(username, item.video.id) : null;
    out.push(buildVideo(username, item.video, detail, item));
  }

  const botname = process.env.BOT_NAME || 'MikuAI';

  return {
    username    : user.uniqueId || username,
    nickname    : user.nickname || '',
    user_id     : user.id || null,
    avatar      : user.avatarThumbUrl || '',
    bio         : user.signature || '',
    verified    : !!user.verified,
    profile_url : 'https://www.tiktok.com/@' + (user.uniqueId || username),
    profile_stats: {
      followers: Number(user.followerCount)  || 0,
      following: Number(user.followingCount) || 0,
      likes    : Number(user.heartCount)     || 0,
    },
    total_video_terbaca: videos.length,
    // Berapa video profil ini yang disematkan (sudah TIDAK dipakai sebagai "latest").
    pinned_count: pinnedCount,
    latest_is_pinned: !!out[0].pinned,
    latest      : out[0],
    videos      : out,
    caption     : buildCaption(username, user, out[0], botname),
    source      : out[0].detail_ok ? 'tiktok-embed + browser-detail' : 'tiktok-embed',
  };
}

/* ─── Routes ─────────────────────────────────────────────────────────────── */

async function handle(req, res) {
  const src      = req.method === 'POST' ? (req.body || {}) : req.query;
  const username = src.username || src.user || src.q || src.unique_id || '';

  const v = validate.fields({ username }, { username: { required: true, type: 'string' } });
  if (!v.valid) throw new ValidationError(v.errors.join(', '), 400);

  sendSuccessResponse(res, await cekVideoTiktok(username, {
    count      : src.count,
    detail     : src.detail,
    skip_pinned: src.skip_pinned || src.skipPinned,
  }));
}

router.get ('/api/stalk/cekvt', asyncHandler(handle));
router.post('/api/stalk/cekvt', asyncHandler(handle));

// Alias agar mudah diingat
router.get ('/api/stalk/tiktok-video', asyncHandler(handle));
router.post('/api/stalk/tiktok-video', asyncHandler(handle));

router.metadata = [
  {
    name:        'TikTok Cek Video (cekvt)',
    path:        '/api/stalk/cekvt',
    methods:     ['GET', 'POST'],
    category:    'STALK',
    description: 'Cek video TERBARU (berdasarkan waktu upload, video yang disematkan/pin tidak dianggap terbaru) dari sebuah akun TikTok: link .mp4 langsung tanpa watermark, durasi, waktu upload, dan statistik lengkap (tayangan, suka, komentar, bagikan). Menyertakan field "caption" siap pakai untuk bot WhatsApp. Detail statistik diambil dengan Chrome headless (puppeteer) karena request HTTP biasa diblokir TikTok.',
    params: [
      {
        name:        'username',
        type:        'text',
        required:    true,
        placeholder: 'yixeno1',
        description: 'Username TikTok (dengan/tanpa @, boleh juga URL profil atau URL video).',
      },
      {
        name:        'count',
        type:        'number',
        required:    false,
        placeholder: '1',
        description: 'Jumlah video terbaru yang diambil (1-' + MAX_COUNT + '), urut dari yang paling baru. Default 1.',
      },
      {
        name:        'skip_pinned',
        type:        'text',
        required:    false,
        placeholder: 'false',
        description: 'Set "true" untuk mengabaikan video yang disematkan sama sekali. Default "false" — video sematan tetap ikut, tapi diurutkan sesuai waktu upload sehingga tidak lagi otomatis dianggap terbaru.',
      },
      {
        name:        'detail',
        type:        'text',
        required:    false,
        placeholder: 'true',
        description: 'Set "false" untuk melewati pengambilan statistik via browser (jauh lebih cepat, tapi likes/komentar/durasi tidak terisi).',
      },
    ],
  },
  {
    name:        'TikTok Cek Video (alias)',
    path:        '/api/stalk/tiktok-video',
    methods:     ['GET', 'POST'],
    category:    'STALK',
    description: 'Alias dari /api/stalk/cekvt.',
    params: [
      { name: 'username', type: 'text', required: true, placeholder: 'yixeno1', description: 'Username TikTok.' },
    ],
  },
];

module.exports = router;
