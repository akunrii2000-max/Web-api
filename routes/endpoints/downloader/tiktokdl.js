'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();
const UA = 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36';

router.get('/api/downloader/tiktok/v2', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/downloader/tiktok/v2', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ url }, res) {
    if (!url || !/tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com/i.test(url)) throw new ValidationError('Parameter "url" harus URL TikTok.');
    const { data } = await axios.get('https://tiktok-scraper7.p.rapidapi.com', { headers: { 'user-agent': UA, 'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com', 'x-rapidapi-key': 'ca5c6d6fa3mshfcd2b0a0feac6b7p140e57jsn72684628152a' }, params: { url, hd: '1' } });
    sendSuccessResponse(res, data.data);
}

router.metadata = [
    { name: 'TikTok DL v2', path: '/api/downloader/tiktok/v2', methods: ['GET', 'POST'], category: 'DOWNLOADER', description: 'Download video TikTok HD.', params: [{ name: 'url', type: 'string', required: true }] },
];

module.exports = router;
