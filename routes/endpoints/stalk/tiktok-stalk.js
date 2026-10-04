'use strict';

const { Router } = require('express');
const axios       = require('axios');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse }                      = require('../../../config/apikeyConfig');

const router = Router();

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

// Sumber: https://www.tiktok.com/embed/@<user> — halaman embed profil berisi
// state JSON __FRONTITY_CONNECT_STATE__ dengan userInfo + videoList lengkap
// (id, desc, cover, playAddr, playCount) TANPA login.
async function fetchEmbedState(username) {
  let r;
  try {
    r = await axios.get(`https://www.tiktok.com/embed/@${encodeURIComponent(username)}`, {
      timeout: 30000,
      validateStatus: s => s < 400,
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', Accept: 'text/html,*/*', Referer: 'https://www.tiktok.com/' },
    });
  } catch (e) {
    throw new ValidationError(`Gagal mengambil halaman embed TikTok: ${e.message}`, 502);
  }

  const html = String(r.data || '');
  const m = /<script id="__FRONTITY_CONNECT_STATE__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new ValidationError('Embed TikTok tidak memuat data (FRONTITY state tidak ditemukan).', 502);

  let state;
  try { state = JSON.parse(m[1]); } catch (e) { throw new ValidationError('Gagal parse state embed TikTok.', 502); }

  const data = state?.source?.data || {};
  const key = Object.keys(data).find(k => k.startsWith('/embed/'));
  if (!key) throw new ValidationError('Data embed tidak ditemukan.', 502);

  return data[key];
}

async function getTikTokPosts(username) {
  const user = String(username).trim().replace(/^@/, '');
  if (!user) throw new ValidationError('Parameter user wajib diisi.', 400);

  const node = await fetchEmbedState(user);
  const u = node?.userInfo || {};
  if (u.code && u.code !== 200) throw new ValidationError('User tidak ditemukan atau privat.', 404);

  const videos = (node?.videoList || []).map(v => ({
    id:             v.id || null,
    title:          v.desc || '',
    url:            v.id ? `https://www.tiktok.com/@${v.authorUniqueId || user}/video/${v.id}` : null,
    cover:          v.coverUrl || null,
    origin_cover:   v.originCoverUrl || null,
    dynamic_cover:  v.dynamicCoverUrl || null,
    play:           v.playAddr || null,
    duration:       v.duration || null,
    ratio:          v.ratio || null,
    width:          v.width || null,
    height:         v.height || null,
    views:          v.playCount ?? null,
    private:        !!v.privateItem,
  }));

  return {
    user: {
      username:  u.uniqueId || user,
      nickname:  u.nickname || null,
      avatar:    u.avatarThumbUrl || null,
      bio:       u.signature || null,
      verified:  !!u.verified,
      private:   !!u.privateAccount,
      followers: u.followerCount ?? null,
      following: u.followingCount ?? null,
      likes:     u.heartCount ?? null,
    },
    videos,
    total: videos.length,
    note: 'Halaman embed menampilkan ±13 video teratas; untuk video lain gunakan detail per video.',
  };
}

// ── GET ──────────────────────────────────────────────────────────────────────
router.get('/api/stalk/tiktok-posts', asyncHandler(async (req, res) => {
  const user = req.query.user || req.query.username || '';
  const v = validate.fields({ user }, { user: { required: true, type: 'string' } });
  if (!v.valid) throw new ValidationError(v.errors.join(', '), 400);

  sendSuccessResponse(res, await getTikTokPosts(user));
}));

// ── POST ─────────────────────────────────────────────────────────────────────
router.post('/api/stalk/tiktok-posts', asyncHandler(async (req, res) => {
  const user = req.body.user || req.body.username || '';
  const v = validate.fields({ user }, { user: { required: true, type: 'string' } });
  if (!v.valid) throw new ValidationError(v.errors.join(', '), 400);

  sendSuccessResponse(res, await getTikTokPosts(user));
}));

// ── Metadata ─────────────────────────────────────────────────────────────────
router.metadata = {
  name:        'TikTok Posts',
  path:        '/api/stalk/tiktok-posts',
  methods:     ['GET', 'POST'],
  category:    'STALK',
  description: 'Daftar video postingan akun TikTok (tanpa login), diambil dari halaman embed profil.',
  params: [
    {
      name:        'user',
      type:        'text',
      required:    true,
      placeholder: 'dongtube_official',
      description: 'Username TikTok (dengan atau tanpa @).',
    },
  ],
};

module.exports = router;
