'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function searchTikTok(query, count = 15) {

  const fetchCount = Math.max(parseInt(count, 10), 15);

  const params = new URLSearchParams({
    keywords: query.trim(),
    count:    fetchCount,
    cursor:   0,
    web:      1,
    hd:       1,
  });

  const { data } = await axios.post(
    'https://tikwm.com/api/feed/search',
    params.toString(),
    {
      headers: {
        'Content-Type':     'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept':           'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 30000,
    }
  );

  if (!data || !data.data || !data.data.videos || data.data.videos.length === 0) {
    throw new ValidationError('No videos found', 404);
  }

  const videos = data.data.videos.slice(0, parseInt(count, 10));

  return videos.map((video) => ({
    id:     video.video_id || video.id,
    title:  video.title,
    author: {
      name:     video.author.nickname,
      username: video.author.unique_id,
      avatar:   video.author.avatar,
    },
    stats: {
      play_count:    video.play_count,
      like_count:    video.digg_count,
      comment_count: video.comment_count,
      share_count:   video.share_count,
    },
    music: video.music_info,
    media: {
      no_watermark: 'https://tikwm.com' + video.play,
      watermark:    'https://tikwm.com' + video.wmplay,
      music:        'https://tikwm.com' + video.music,
      cover:        'https://tikwm.com' + video.cover,
    },
    duration:    video.duration,
    create_time: video.create_time,
  }));
}

router.get('/api/search/tiktok', asyncHandler(async (req, res) => {
  const { q, query, count = 15 } = req.query;
  const searchQuery = q || query;

  if (!validate.notEmpty(searchQuery)) {
    throw new ValidationError('Query parameter (q or query) is required', 400);
  }
  if (!validate.number(count, 1, 50)) {
    throw new ValidationError('Count must be between 1 and 50', 400);
  }

  const results = await searchTikTok(searchQuery, parseInt(count, 10));
  sendSuccessResponse(res, { query: searchQuery, count: results.length, results });
}));

router.post('/api/search/tiktok', asyncHandler(async (req, res) => {
  const { query, count = 15 } = req.body;

  if (!validate.notEmpty(query)) {
    throw new ValidationError('Query is required', 400);
  }
  if (!validate.number(count, 1, 50)) {
    throw new ValidationError('Count must be between 1 and 50', 400);
  }

  const results = await searchTikTok(query, parseInt(count, 10));
  sendSuccessResponse(res, { query, count: results.length, results });
}));

router.metadata = {
  name:        'TikTok Search',
  path:        '/api/search/tiktok',
  methods:     ['GET', 'POST'],
  category:    'SEARCH',
  description: 'Search TikTok videos with download links (no watermark available). Returns video info, author, stats, and media URLs.',
  params: [
    { name: 'q',     type: 'text',   required: true,  placeholder: 'funny cats', description: "Search query (GET: 'q' atau 'query', POST: 'query')" },
    { name: 'count', type: 'number', required: false, placeholder: '15',         description: 'Jumlah hasil (1-50, default: 15)' },
  ],
};

module.exports = router;
