'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();
const UA = 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36';

router.get('/api/tools/bypasstools', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/tools/bypasstools', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ url }, res) {
    if (!url || !url.startsWith('https://')) throw new ValidationError('Parameter "url" wajib diisi (https).');
    const { data: cf } = await axios.post('https://rynekoo-cf.hf.space/action', { url: 'https://bypass.tools/', mode: 'turnstile-min', siteKey: '0x4AAAAAACXArKb_xnkUnwy8' });
    if (!cf?.data?.token) throw new Error('Failed to get cf token.');
    const { data } = await axios.post('https://bypass.tools/api/bypass', { url, captchaToken: cf.data.token, isPremium: false, key: null, forceRefresh: false }, {
        headers: { 'content-type': 'application/json', origin: 'https://bypass.tools', referer: 'https://bypass.tools/', 'user-agent': UA }
    });
    sendSuccessResponse(res, data);
}

router.metadata = [
    { name: 'Bypass.tools', path: '/api/tools/bypasstools', methods: ['GET', 'POST'], category: 'TOOLS', description: 'Bypass shortlink/iklan via Bypass.tools.', params: [{ name: 'url', type: 'string', required: true }] },
];

module.exports = router;
