'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

router.get('/api/downloader/pindl', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/downloader/pindl', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ url }, res) {
    if (!url || !url.includes('pin.it')) throw new ValidationError('Parameter "url" harus URL pin.it.');
    const { headers } = await axios.get('https://pinterestdownloader.io/');
    const { data } = await axios.get(`https://pinterestdownloader.io/frontendService/DownloaderService?url=${url}`, { headers: { accept: '*/*', cookie: headers['set-cookie'].join('; '), referer: 'https://pinterestdownloader.io/', 'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36' } });
    sendSuccessResponse(res, data);
}

router.metadata = [
    { name: 'Pinterest DL', path: '/api/downloader/pindl', methods: ['GET', 'POST'], category: 'DOWNLOADER', description: 'Download gambar dari Pinterest via pin.it URL.', params: [{ name: 'url', type: 'string (pin.it)', required: true }] },
];

module.exports = router;
