'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();
const UA = 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36';

router.get('/api/tools/brainly', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/tools/brainly', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ query, limit = 20 }, res) {
    if (!query) throw new ValidationError('Parameter "query" wajib diisi.');
    const { data } = await axios.get(`https://cloudflare-cors-anywhere.supershadowcube.workers.dev/?url=${encodeURIComponent(`https://brainly.com/bff/social-qa/answer-experience-web/api/v1/search?query=${encodeURIComponent(query)}&limit=${limit}&market=id`)}`, {
        headers: { origin: 'https://brainly.co.id', referer: 'https://brainly.co.id/', 'user-agent': UA }
    });
    sendSuccessResponse(res, { results: data.data.results });
}

router.metadata = [
    { name: 'Brainly', path: '/api/tools/brainly', methods: ['GET', 'POST'], category: 'TOOLS', description: 'Cari jawaban soal di Brainly Indonesia.', params: [{ name: 'query', type: 'string', required: true }, { name: 'limit', type: 'number', required: false }] },
];

module.exports = router;
