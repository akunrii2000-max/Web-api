'use strict';

const { Router } = require('express');
const axios      = require('axios');
const crypto     = require('crypto');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

router.get('/api/downloader/tiktok/v1', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/downloader/tiktok/v1', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ url }, res) {
    if (!url || !/tiktok\.com/.test(url)) throw new ValidationError('Parameter "url" harus URL TikTok.');
    const k = { enc: 'GJvE5RZIxrl9SuNrAtgsvCfWha3M7NGC', dec: 'H3quWdWoHLX5bZSlyCYAnvDFara25FIu' };
    const cryptoProc = (type, data) => {
        const key = Buffer.from(k[type]); const iv = Buffer.from(k[type].slice(0, 16));
        const cipher = (type === 'enc' ? crypto.createCipheriv : crypto.createDecipheriv)('aes-256-cbc', key, iv);
        let r = cipher.update(data, ...(type === 'enc' ? ['utf8', 'base64'] : ['base64', 'utf8']));
        r += cipher.final(type === 'enc' ? 'base64' : 'utf8'); return r;
    };
    const { data } = await axios.post('https://savetik.app/requests', { bdata: cryptoProc('enc', url) }, { headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 (Android 16; Mobile; SM-D639N; rv:130.0) Gecko/130.0 Firefox/130.0' } });
    if (!data || data.status !== 'success') throw new Error('Fetch failed.');
    sendSuccessResponse(res, { caption: data.vmtitle, author: data.username, thumbnail: data.thumbnailUrl, video: cryptoProc('dec', data.data), audio: data.mp3 });
}

router.metadata = [
    { name: 'TikTok DL v1', path: '/api/downloader/tiktok/v1', methods: ['GET', 'POST'], category: 'DOWNLOADER', description: 'Download video TikTok tanpa watermark.', params: [{ name: 'url', type: 'string', required: true }] },
];

module.exports = router;
