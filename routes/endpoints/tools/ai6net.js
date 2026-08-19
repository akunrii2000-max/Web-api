'use strict';

const { Router } = require('express');
const axios      = require('axios');
const cheerio    = require('cheerio');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();
const UA = 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36';

router.get('/api/tools/ai6net', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/tools/ai6net', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ url }, res) {
    if (!url || !url.includes('https://')) throw new ValidationError('Parameter "url" wajib diisi (harus https).');
    const { data } = await axios.post('https://ai6.net/', new URLSearchParams({ gblshortlink: url, gblshortdomain: '' }).toString(), {
        headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://ai6.net', referer: 'https://ai6.net/', 'user-agent': UA }
    });
    const $ = cheerio.load(data);
    const result = $('input#GBLInput').attr('value');
    if (!result) throw new ValidationError('No result found.', 404);
    sendSuccessResponse(res, { shortUrl: result });
}

router.metadata = [
    { name: 'AI6Net Shortener Bypass', path: '/api/tools/ai6net', methods: ['GET', 'POST'], category: 'TOOLS', description: 'Bypass URL shortener/iklan via AI6.net.', params: [{ name: 'url', type: 'string', required: true }] },
];

module.exports = router;
