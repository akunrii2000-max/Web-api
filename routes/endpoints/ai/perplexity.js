'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { v4: uuidv4 } = require('uuid');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

router.get('/api/ai/perplexity', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/ai/perplexity', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ query, source }, res) {
    if (!query) throw new ValidationError('Parameter "query" wajib diisi.');
    const srcObj = source ? (typeof source === 'string' ? JSON.parse(source) : source) : { web: true };
    const sourceMapping = { web: 'web', academic: 'scholar', social: 'social', finance: 'edgar' };
    const activeSources = Object.keys(srcObj).filter(k => srcObj[k]).map(k => sourceMapping[k]).filter(Boolean);
    const frontend = uuidv4();
    const { data } = await axios.post('https://cloudflare-cors-anywhere.supershadowcube.workers.dev/?url=https://www.perplexity.ai/rest/sse/perplexity_ask', {
        params: { attachments: [], language: 'en-US', timezone: 'Asia/Jakarta', sources: activeSources.length ? activeSources : ['web'], frontend_uuid: frontend, mode: 'concise', model_preference: 'turbo', is_related_query: false, visitor_id: uuidv4(), frontend_context_uuid: uuidv4(), use_schematized_api: true, send_back_text_in_streaming_api: false, dsl_query: query },
        query_str: query
    }, { headers: { 'content-type': 'application/json', referer: 'https://www.perplexity.ai/search/', 'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36', 'x-request-id': frontend } });
    const result = data.split('\n').filter(l => l?.startsWith('data:')).map(l => JSON.parse(l.substring(6))).find(l => l.final_sse_message);
    const info = JSON.parse(result.text);
    sendSuccessResponse(res, { id: result.uuid, query: result.query_str, related_queries: result.related_queries, response: { answer: JSON.parse(info.find(l => l.step_type === 'FINAL')?.content?.answer)?.answer, search_results: info.find(l => l.step_type === 'SEARCH_RESULTS')?.content?.web_results || [] } });
}

router.metadata = [
    { name: 'Perplexity', path: '/api/ai/perplexity', methods: ['GET', 'POST'], category: 'AI', description: 'AI search dengan sumber terverifikasi via Perplexity.', params: [{ name: 'query', type: 'string', required: true }, { name: 'source', type: 'object', required: false }] },
];

module.exports = router;
