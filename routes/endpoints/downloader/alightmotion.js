'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

router.get('/api/downloader/alightmotion', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/downloader/alightmotion', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ url }, res) {
    const match = url?.match(/\/u\/([^\/]+)\/p\/([^\/\?#]+)/);
    if (!match) throw new ValidationError('URL AlightMotion tidak valid.');
    const { data } = await axios.post('https://us-central1-alight-creative.cloudfunctions.net/getProjectMetadata', { data: { uid: match[1], pid: match[2], platform: 'android', appBuild: 1002592, acctTestMode: 'normal' } }, { headers: { 'content-type': 'application/json; charset=utf-8' } });
    sendSuccessResponse(res, data.result);
}

router.metadata = [
    { name: 'AlightMotion', path: '/api/downloader/alightmotion', methods: ['GET', 'POST'], category: 'DOWNLOADER', description: 'Ambil metadata project AlightMotion.', params: [{ name: 'url', type: 'string', required: true }] },
];

module.exports = router;
