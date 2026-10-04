'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

router.get('/api/downloader/ssvid', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/downloader/ssvid', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ url }, res) {
    if (!url || !url.startsWith('https://')) throw new ValidationError('Parameter "url" wajib diisi (https).');
    const { data } = await axios.post('https://ssvid.net/api/ajax/search?hl=en', new URLSearchParams({ query: url, cf_token: '', vt: 'home' }).toString(), { headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', origin: 'https://ssvid.net', referer: 'https://ssvid.net/en-3', 'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/139.0.0.0 Mobile Safari/537.36', 'x-requested-with': 'XMLHttpRequest' } });
    sendSuccessResponse(res, data?.data || data);
}

router.metadata = [
    { name: 'SSVID (IG/FB/dll)', path: '/api/downloader/ssvid', methods: ['GET', 'POST'], category: 'DOWNLOADER', description: 'Download media Instagram, Facebook, dll via SSVID.', params: [{ name: 'url', type: 'string', required: true }] },
];

module.exports = router;
