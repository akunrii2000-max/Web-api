'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

router.get('/api/tools/lrclib', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/tools/lrclib', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ title }, res) {
    if (!title) throw new ValidationError('Parameter "title" wajib diisi.');
    const { data } = await axios.get(`https://lrclib.net/api/search?q=${encodeURIComponent(title)}`, { headers: { referer: `https://lrclib.net/search/${encodeURIComponent(title)}`, 'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36' } });
    sendSuccessResponse(res, { results: data });
}

router.metadata = [
    { name: 'LRCLib Lirik', path: '/api/tools/lrclib', methods: ['GET', 'POST'], category: 'TOOLS', description: 'Cari lirik lagu dari LRCLib.', params: [{ name: 'title', type: 'string', required: true }] },
];

module.exports = router;
