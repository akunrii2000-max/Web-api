'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

router.get('/api/ai/turboseek', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/ai/turboseek', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ question }, res) {
    if (!question) throw new ValidationError('Parameter "question" wajib diisi.');
    const inst = axios.create({ baseURL: 'https://www.turboseek.io/api', headers: { origin: 'https://www.turboseek.io', referer: 'https://www.turboseek.io/', 'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958) Chrome/130.0.6723.86 Mobile Safari/537.36' } });
    const { data: sources } = await inst.post('/getSources', { question });
    const [{ data: similarQuestions }, { data: answer }] = await Promise.all([
        inst.post('/getSimilarQuestions', { question, sources }),
        inst.post('/getAnswer', { question, sources })
    ]);
    const cleanAnswer = answer.match(/<p>(.*?)<\/p>/gs)?.map(m => m.replace(/<\/?[^>]+>/g, '').trim()).join('\n\n') || answer.replace(/<\/?[^>]+>/g, '').trim();
    sendSuccessResponse(res, { answer: cleanAnswer, sources: sources.map(s => ({ title: s.title, url: s.url })), similarQuestions });
}

router.metadata = [
    { name: 'Turboseek', path: '/api/ai/turboseek', methods: ['GET', 'POST'], category: 'AI', description: 'AI search dengan sumber & similar questions via Turboseek.', params: [{ name: 'question', type: 'string', required: true }] },
];

module.exports = router;
