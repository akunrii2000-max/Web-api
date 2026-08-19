'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

router.get('/api/downloader/clipto', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/downloader/clipto', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ url }, res) {
    if (!url || !/youtube.com|youtu.be/.test(url)) throw new ValidationError('Parameter "url" harus URL YouTube.');
    const { data } = await axios.post('https://www.clipto.com/api/youtube', { url }, { headers: { 'content-type': 'application/json', referer: 'https://www.clipto.com/id/media-downloader/youtube-audio-downloader', 'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36' } });
    sendSuccessResponse(res, data);
}

router.metadata = [
    { name: 'Clipto YouTube Audio', path: '/api/downloader/clipto', methods: ['GET', 'POST'], category: 'DOWNLOADER', description: 'Download audio YouTube via Clipto.', params: [{ name: 'url', type: 'string', required: true }] },
];

module.exports = router;
