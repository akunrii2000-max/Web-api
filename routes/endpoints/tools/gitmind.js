'use strict';

const { Router } = require('express');
const axios      = require('axios');
const crypto     = require('crypto');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

router.get('/api/tools/gitmind', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/tools/gitmind', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ url, lang = 'id' }, res) {
    if (!url || !/youtube\.com|youtu\.be/.test(url)) throw new ValidationError('Parameter "url" harus URL YouTube.');
    const UserAgent = require('user-agents');
    const ua = new UserAgent({ deviceCategory: 'mobile' });
    const randomDeviceHash = crypto.randomBytes(16).toString('hex');
    const { data: a } = await axios.post('https://gw.aoscdn.com/base/passport/v2/login/anonymous', {
        brand_id: 29, type: 27, platform: [1, 2, 3][Math.floor(Math.random() * 3)],
        cli_os: 'web', device_hash: randomDeviceHash,
        os_name: ua.data.platform, os_version: ua.data.userAgent.match(/OS (\d+)/)?.[1] ?? '14'
    }, { headers: { 'content-type': 'application/json' } });
    const token = a?.data?.token;
    if (!token) throw new Error('Failed to get token.');
    const { data: b } = await axios.post('https://gw.aoscdn.com/app/gitmind/youtube-to-mind-map/task/create', { url, lang }, {
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }
    });
    const taskId = b?.data?.task_id;
    if (!taskId) throw new Error('Failed to create task.');
    const MAX_ATTEMPTS_GM = 40; let attempts_gm = 0;
    while (true) {
        if (++attempts_gm > MAX_ATTEMPTS_GM) throw new ValidationError('Processing timeout.', 504);
        const { data: c } = await axios.get(`https://gw.aoscdn.com/app/gitmind/youtube-to-mind-map/task/result?task_id=${taskId}`, {
            headers: { authorization: `Bearer ${token}` }
        });
        if (c?.data?.status === 2) { sendSuccessResponse(res, c.data); return; }
        if (c?.data?.status === 3) throw new Error('Task failed.');
        await new Promise(r => setTimeout(r, 3000));
    }
}

router.metadata = [
    { name: 'GitMind YouTube', path: '/api/tools/gitmind', methods: ['GET', 'POST'], category: 'TOOLS', description: 'Buat mind map dari video YouTube via GitMind.', params: [{ name: 'url', type: 'string (YouTube)', required: true }, { name: 'lang', type: 'string', required: false }] },
];

module.exports = router;
