'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

router.get('/api/ai/webpilot', asyncHandler(async (req, res) => { await handleWebpilot(req.query, res); }));
router.post('/api/ai/webpilot', asyncHandler(async (req, res) => { await handleWebpilot(req.body, res); }));

async function handleWebpilot({ query }, res) {
    if (!query) throw new ValidationError('Parameter "query" wajib diisi.');
    const { data } = await axios.post('https://api.webpilotai.com/rupee/v1/search', { q: query, threadId: '' }, {
        headers: { authority: 'api.webpilotai.com', accept: 'application/json, text/plain, */*, text/event-stream', authorization: 'Bearer null', 'content-type': 'application/json;charset=UTF-8', origin: 'https://www.webpilot.ai', referer: 'https://www.webpilot.ai/', 'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' }
    });
    let content = ''; const sources = [];
    data.split('\n').forEach(line => {
        if (line.startsWith('data:')) {
            try {
                const json = JSON.parse(line.slice(5));
                if (json.type === 'data' && json.data?.section_id === void 0 && json.data?.content) content += json.data.content;
                if (json.action === 'using_internet' && json.data) sources.push(json.data);
            } catch {}
        }
    });
    sendSuccessResponse(res, { content, sources });
}

router.metadata = [
    { name: 'Webpilot Search', path: '/api/ai/webpilot', methods: ['GET', 'POST'], category: 'AI', description: 'AI web search via Webpilot.', params: [{ name: 'query', type: 'string', required: true }] },
];

module.exports = router;
