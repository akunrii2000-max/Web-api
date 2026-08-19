'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function stalkTiktok(username) {
  const clean = username.replace(/^@/, '').trim();
  if (!clean) throw new ValidationError('Username tidak boleh kosong.', 400);

  let data;
  try {
    const res = await axios.get('https://www.tikwm.com/api/user/info', {
      params: { unique_id: clean },
      headers: { 'User-Agent': UA },
      timeout: 15000,
    });
    data = res.data;
  } catch (err) {
    if (err.response) throw new ValidationError(`TikWM error: ${err.response.data?.msg || err.response.statusText}`, err.response.status);
    throw new ValidationError(err.message || 'Gagal menghubungi TikWM API.', 500);
  }

  if (!data || data.code !== 0) {
    throw new ValidationError(data?.msg || 'Akun tidak ditemukan atau username salah.', 404);
  }

  // Struktur response: data.data.user & data.data.stats
  const u = data.data.user;
  const s = data.data.stats;

  return {
    username:   u.uniqueId,
    nickname:   u.nickname,
    user_id:    u.id,
    sec_uid:    u.secUid,
    bio:        u.signature     || '',
    avatar: {
      thumb:    u.avatarThumb  || '',
      medium:   u.avatarMedium || '',
      large:    u.avatarLarger || '',
    },
    verified:   !!u.verified,
    private:    !!u.secret || !!u.privateAccount,
    region:     u.region   || '',
    language:   u.language || '',
    created_at: u.createTime ? new Date(u.createTime * 1000).toISOString() : null,
    social: {
      instagram: u.ins_id                 || null,
      twitter:   u.twitter_id            || null,
      youtube:   u.youtube_channel_title || null,
    },
    stats: {
      following: s.followingCount,
      followers: s.followerCount,
      likes:     s.heartCount,
      videos:    s.videoCount,
    },
    profile_url: `https://www.tiktok.com/@${u.uniqueId}`,
  };
}

router.get('/api/stalk/tiktok', asyncHandler(async (req, res) => {
  const username = req.query.username || req.query.user || req.query.q || '';
  const v = validate.fields({ username }, { username: { required: true, type: 'string' } });
  if (!v.valid) throw new ValidationError(v.errors.join(', '), 400);
  sendSuccessResponse(res, await stalkTiktok(username));
}));

router.post('/api/stalk/tiktok', asyncHandler(async (req, res) => {
  const username = req.body.username || req.body.user || req.body.q || '';
  const v = validate.fields({ username }, { username: { required: true, type: 'string' } });
  if (!v.valid) throw new ValidationError(v.errors.join(', '), 400);
  sendSuccessResponse(res, await stalkTiktok(username));
}));

router.metadata = {
  name:        'TikTok Stalk',
  path:        '/api/stalk/tiktok',
  methods:     ['GET', 'POST'],
  category:    'STALK',
  description: 'Ambil informasi profil pengguna TikTok berdasarkan username. Mengembalikan data followers, following, jumlah video, likes, avatar (thumb/medium/large), bio, dan status verifikasi.',
  params: [
    {
      name:        'username',
      type:        'text',
      required:    true,
      placeholder: 'luxiaoyu01',
      description: 'Username TikTok (dengan atau tanpa @). Contoh: luxiaoyu01 atau @luxiaoyu01',
    },
  ],
};

module.exports = router;
