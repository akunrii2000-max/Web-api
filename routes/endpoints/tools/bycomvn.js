'use strict';

const { Router }  = require('express');
const axios       = require('axios');
const FormData    = require('form-data');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();
const UA = 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36';

router.get('/api/tools/bycomvn', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/tools/bycomvn', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ url }, res) {
    if (!url || !url.startsWith('https://')) throw new ValidationError('Parameter "url" wajib diisi (https).');
    const { data: cf } = await axios.post('https://rynekoo-cf.hf.space/action', { url: 'https://by.com.vn/', mode: 'waf-session' });
    if (!cf?.data?.cookies) throw new Error('Failed to get cookies.');
    const form = new FormData();
    form.append('url', url);
    const { data } = await axios.post('https://by.com.vn/shorten', form, {
        headers: { ...form.getHeaders(), cookie: cf.data.cookies.map(c => `${c.name}=${c.value}`).join('; '), origin: 'https://by.com.vn', referer: 'https://by.com.vn/', 'user-agent': UA, 'x-requested-with': 'XMLHttpRequest' }
    });
    sendSuccessResponse(res, data.data);
}

router.metadata = [
    { name: 'By.com.vn Shorten', path: '/api/tools/bycomvn', methods: ['GET', 'POST'], category: 'TOOLS', description: 'Shorten URL via By.com.vn.', params: [{ name: 'url', type: 'string', required: true }] },
];

module.exports = router;
