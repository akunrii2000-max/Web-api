'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();
const UA = 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36';

router.get('/api/tools/bypasscity', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/tools/bypasscity', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ url }, res) {
    if (!url) throw new ValidationError('Parameter "url" wajib diisi.');
    const { data: cf } = await axios.post('https://rynekoo-cf.hf.space/action', { url: `https://bypass.city/bypass?bypass=${encodeURIComponent(url)}`, mode: 'turnstile-min', siteKey: '0x4AAAAAAAGzw6rXeQWJ_y2P' });
    if (!cf?.data?.token) throw new Error('Failed to get cf token.');
    const { data } = await axios.post('https://api2.bypass.city/bypass', { url }, {
        headers: { accept: '*/*', 'content-type': 'application/json', origin: 'https://bypass.city', referer: 'https://bypass.city/', 'user-agent': UA, token: cf.data.token, 'x-captcha-provider': 'TURNSTILE' }
    });
    sendSuccessResponse(res, { name: data.name, link: data.data });
}

router.metadata = [
    { name: 'Bypass.city', path: '/api/tools/bypasscity', methods: ['GET', 'POST'], category: 'TOOLS', description: 'Bypass shortlink/iklan via Bypass.city.', params: [{ name: 'url', type: 'string', required: true }] },
];

module.exports = router;
