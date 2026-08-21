'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

router.get('/api/downloader/saveweb2zip', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/downloader/saveweb2zip', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ url, renameAssets = false, saveStructure = false, alternativeAlgorithm = false, mobileVersion = false }, res) {
    if (!url) throw new ValidationError('Parameter "url" wajib diisi.');
    if (!validate.url(url)) throw new ValidationError('URL tidak valid.');
    const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    const headers = { accept: '*/*', 'content-type': 'application/json', origin: 'https://saveweb2zip.com', referer: 'https://saveweb2zip.com/', 'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36' };
    const { data } = await axios.post('https://copier.saveweb2zip.com/api/copySite', { url: fullUrl, renameAssets: Boolean(renameAssets), saveStructure: Boolean(saveStructure), alternativeAlgorithm: Boolean(alternativeAlgorithm), mobileVersion: Boolean(mobileVersion) }, { headers });
    const MAX_ATTEMPTS_SW = 60; let attempts_sw = 0;
    while (true) {
        if (++attempts_sw > MAX_ATTEMPTS_SW) throw new ValidationError('Processing timeout.', 504);
        const { data: process } = await axios.get(`https://copier.saveweb2zip.com/api/getStatus/${data.md5}`, { headers });
        if (process.isFinished) { sendSuccessResponse(res, { url: fullUrl, error: { text: process.errorText, code: process.errorCode }, copiedFilesAmount: process.copiedFilesAmount, downloadUrl: `https://copier.saveweb2zip.com/api/downloadArchive/${process.md5}` }); return; }
        await new Promise(r => setTimeout(r, 1000));
    }
}

router.metadata = [
    { name: 'SaveWeb2Zip', path: '/api/downloader/saveweb2zip', methods: ['GET', 'POST'], category: 'DOWNLOADER', description: 'Download seluruh website sebagai file ZIP.', params: [{ name: 'url', type: 'string', required: true }] },
];

module.exports = router;
