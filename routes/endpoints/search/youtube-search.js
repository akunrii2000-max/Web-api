'use strict';

const { Router } = require('express');
const yts        = require('yt-search');
const { asyncHandler, ValidationError } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function searchYoutube(query) {
    const results = await yts(query);
    if (!results?.videos?.length) throw new ValidationError('Tidak ada video ditemukan.', 404);
    return results.videos.slice(0, 10).map(v => ({
        id:        v.videoId,
        title:     v.title,
        url:       v.url,
        thumbnail: v.thumbnail,
        duration:  v.timestamp,
        views:     v.views,
        ago:       v.ago,
        channel: {
            name: v.author.name,
            url:  v.author.url,
        },
    }));
}

async function handle(params, res) {
    const q = (params.query || params.q || '').trim();
    if (!q) throw new ValidationError('Parameter "query" wajib diisi.');
    const data = await searchYoutube(q);
    sendSuccessResponse(res, { query: q, count: data.length, results: data });
}

router.get('/api/search/youtube', asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/search/youtube', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = {
    name:        'YouTube Search',
    path:        '/api/search/youtube',
    methods:     ['GET', 'POST'],
    category:    'SEARCH',
    description: 'Cari video YouTube. Mengembalikan ID, judul, URL, thumbnail, durasi, views, dan info channel.',
    params: [
        {
            name:        'query',
            type:        'text',
            required:    true,
            placeholder: 'alan walker faded',
            description: 'Kata kunci pencarian (juga bisa pakai: q)',
        },
    ],
};

module.exports = router;
