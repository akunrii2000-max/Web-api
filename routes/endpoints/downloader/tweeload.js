'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

router.get('/api/downloader/tweeload', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/downloader/tweeload', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ url }, res) {
    if (!url || !/^https?:\/\/(www\.)?(twitter\.com|x\.com)\/.+\/status\/\d+/i.test(url)) throw new ValidationError('URL Twitter/X tidak valid.');
    const { data } = await axios.get(`https://tweeload.aculix.net/status/?url=${encodeURIComponent(url)}`, { headers: { authorization: 'cKMQlY4jGCflOStlN3UfnWCxLQSb5GL7UPjPJ3jGS5fkno1Jaf', 'user-agent': 'okhttp/4.12.0' } });
    sendSuccessResponse(res, data.tweet || data);
}

router.metadata = [
    { name: 'Tweeload Twitter/X', path: '/api/downloader/tweeload', methods: ['GET', 'POST'], category: 'DOWNLOADER', description: 'Download media Twitter/X.', params: [{ name: 'url', type: 'string', required: true }] },
];

module.exports = router;
