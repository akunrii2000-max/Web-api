'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();
const UA = 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36';

router.get('/api/downloader/ytdl', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/downloader/ytdl', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ url }, res) {
    if (!url) throw new ValidationError('Parameter "url" wajib diisi.');
    const patterns = [/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/, /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/, /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/, /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/, /youtu\.be\/([a-zA-Z0-9_-]{11})/];
    const id = patterns.find(p => p.test(url))?.[Symbol.match](url)?.[1];
    if (!id) throw new ValidationError('URL YouTube tidak valid.');
    const { data } = await axios.get(`https://ytstream-download-youtube-videos.p.rapidapi.com/dl?id=${id}`, { headers: { 'x-rapidapi-host': 'ytstream-download-youtube-videos.p.rapidapi.com', 'x-rapidapi-key': '6fabfe3ba0msha10853256d5c5f9p1c1247jsnf1625ea46cb6' } });
    sendSuccessResponse(res, data);
}

router.metadata = [
    { name: 'YouTube DL', path: '/api/downloader/ytdl', methods: ['GET', 'POST'], category: 'DOWNLOADER', description: 'Download video/info YouTube via RapidAPI.', params: [{ name: 'url', type: 'string', required: true }] },
];

module.exports = router;
