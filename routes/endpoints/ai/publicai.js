'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

router.get('/api/ai/publicai', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/ai/publicai', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ question }, res) {
    if (!question) throw new ValidationError('Parameter "question" wajib diisi.');
    const genId = (n = 16) => Array.from({ length: n }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]).join('');
    const { data } = await axios.post('https://publicai.co/api/chat', { tools: {}, id: genId(), messages: [{ id: genId(), role: 'user', parts: [{ type: 'text', text: question }] }], trigger: 'submit-message' }, { headers: { origin: 'https://publicai.co', referer: 'https://publicai.co/chat', 'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958) Chrome/130.0.6723.86 Mobile Safari/537.36' } });
    const result = data.split('\n\n').filter(l => l && !l.includes('[DONE]')).map(l => JSON.parse(l.substring(6))).filter(l => l.type === 'text-delta').map(l => l.delta).join('');
    if (!result) throw new ValidationError('No result found.', 500);
    sendSuccessResponse(res, { response: result });
}

router.metadata = [
    { name: 'PublicAI', path: '/api/ai/publicai', methods: ['GET', 'POST'], category: 'AI', description: 'Chat AI via publicai.co.', params: [{ name: 'question', type: 'string', required: true }] },
];

module.exports = router;
