'use strict';

const { Router } = require('express');
const yts        = require('yt-search');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function stalkYoutube(query) {
  let res;
  try {
    res = await yts(query);
  } catch (err) {
    throw new ValidationError(err.message || 'Gagal melakukan pencarian YouTube.', 500);
  }

  const ch  = res.channels?.[0] || null;
  const vid = res.videos?.[0]   || null;

  return {
    meta: {
      total_results: res.all?.length || 0,
      search_query:  query,
    },

    channel: ch ? {
      name:             ch.name,
      url:              ch.url,
      id:               ch.channelId,
      subscribers:      ch.subCount,
      subscribers_text: ch.subCountLabel,
      videos:           ch.videoCount,
      verified:         ch.verified,
      icon:             ch.icon,
      description:      ch.description,
      created_at:       ch.createdAt || null,
    } : null,

    top_video: vid ? {
      title:       vid.title,
      url:         vid.url,
      views:       vid.views,
      views_text:  vid.viewsLabel,
      duration:    vid.timestamp,
      seconds:     vid.seconds,
      ago:         vid.ago,
      author:      vid.author?.name || null,
      author_url:  vid.author?.url  || null,
      thumbnail:   vid.thumbnail,
      description: vid.description  || null,
    } : null,

    videos: (res.videos || []).slice(0, 5).map(v => ({
      title:    v.title,
      url:      v.url,
      views:    v.views,
      duration: v.timestamp,
      ago:      v.ago,
      author:   v.author?.name || null,
      thumbnail: v.thumbnail,
    })),

    related_channels: (res.channels || []).slice(0, 5).map(c => ({
      name:        c.name,
      url:         c.url,
      subscribers: c.subCount,
      verified:    c.verified,
      icon:        c.icon,
    })),
  };
}

router.get('/api/stalk/youtube', asyncHandler(async (req, res) => {
  const query = req.query.q || req.query.query || req.query.username || req.query.user || '';
  const v = validate.fields({ q: query }, { q: { required: true, type: 'string' } });
  if (!v.valid) throw new ValidationError(v.errors.join(', '), 400);
  sendSuccessResponse(res, await stalkYoutube(query));
}));

router.post('/api/stalk/youtube', asyncHandler(async (req, res) => {
  const query = req.body.q || req.body.query || req.body.username || req.body.user || '';
  const v = validate.fields({ q: query }, { q: { required: true, type: 'string' } });
  if (!v.valid) throw new ValidationError(v.errors.join(', '), 400);
  sendSuccessResponse(res, await stalkYoutube(query));
}));

router.metadata = {
  name:        'YouTube Stalk',
  path:        '/api/stalk/youtube',
  methods:     ['GET', 'POST'],
  category:    'STALK',
  description: 'Cari channel dan video YouTube berdasarkan query. Mengembalikan info channel teratas (subscriber, verifikasi, deskripsi), top video, 5 video terkait, dan 5 channel terkait.',
  params: [
    {
      name:        'q',
      type:        'text',
      required:    true,
      placeholder: 'MrBeast',
      description: 'Nama channel atau keyword pencarian YouTube. Contoh: MrBeast, PewDiePie',
    },
  ],
};

module.exports = router;
