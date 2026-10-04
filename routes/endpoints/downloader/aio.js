'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();
const UA = 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36';

router.get('/api/downloader/aio', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/downloader/aio', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ url }, res) {
    if (!url || !url.startsWith('https://')) throw new ValidationError('Parameter "url" wajib diisi (https).');
    const { data } = await axios.post('https://auto-download-all-in-one.p.rapidapi.com/v1/social/autolink', { url }, { headers: { 'content-type': 'application/json; charset=utf-8', 'user-agent': UA, 'x-rapidapi-host': 'auto-download-all-in-one.p.rapidapi.com', 'x-rapidapi-key': 'ca5c6d6fa3mshfcd2b0a0feac6b7p140e57jsn72684628152a' } });
    sendSuccessResponse(res, data);
}

router.metadata = [
    { name: 'AIO Downloader', path: '/api/downloader/aio', methods: ['GET', 'POST'], category: 'DOWNLOADER', description: 'All-in-one social media downloader (IG, TikTok, Twitter, FB, dll).', params: [{ name: 'url', type: 'string', required: true }] },
];

module.exports = router;
