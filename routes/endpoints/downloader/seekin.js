'use strict';

const { Router } = require('express');
const axios      = require('axios');
const crypto     = require('crypto');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();
const UA = 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36';

router.get('/api/downloader/seekin', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/downloader/seekin', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ url }, res) {
    if (!url || !url.startsWith('https://')) throw new ValidationError('Parameter "url" wajib diisi (https).');
    const timestamp = Date.now().toString(); const key = '3HT8hjE79L';
    const body = { url }; const sortedParams = Object.keys(body).sort().map(a => `${a}=${body[a]}`).join('&');
    const sign = crypto.createHash('sha256').update(`en${timestamp}${key}${sortedParams}`).digest('hex');
    const { data } = await axios.post('https://api.seekin.ai/ikool/media/download', body, { headers: { accept: '*/*', 'content-type': 'application/json', lang: 'en', origin: 'https://www.seekin.ai', referer: 'https://www.seekin.ai/', sign, timestamp, 'user-agent': UA } });
    sendSuccessResponse(res, data?.data || data);
}

router.metadata = [
    { name: 'Seekin Multi Downloader', path: '/api/downloader/seekin', methods: ['GET', 'POST'], category: 'DOWNLOADER', description: 'Multi-platform media downloader via Seekin.', params: [{ name: 'url', type: 'string', required: true }] },
];

module.exports = router;
