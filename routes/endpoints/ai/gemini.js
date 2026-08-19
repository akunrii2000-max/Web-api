'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

router.get('/api/ai/gemini', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/ai/gemini', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ message, instruction = '', sessionId = null }, res) {
    if (!message) throw new ValidationError('Parameter "message" wajib diisi.');
    let resumeArray = null; let cookie = null; let savedInstruction = instruction;
    if (sessionId) {
        try { const d = JSON.parse(Buffer.from(sessionId, 'base64').toString()); resumeArray = d.resumeArray; cookie = d.cookie; savedInstruction = instruction || d.instruction || ''; } catch {}
    }
    if (!cookie) {
        const { headers } = await axios.post('https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&bl=boq_assistant-bard-web-server_20250814.06_p1&f.sid=-7816331052118000090&hl=en-US&_reqid=173780&rt=c', 'f.req=%5B%5B%5B%22maGuAc%22%2C%22%5B0%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&', { headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' } });
        cookie = headers['set-cookie']?.[0]?.split('; ')[0] || '';
    }
    const requestBody = [[message, 0, null, null, null, null, 0], ['en-US'], resumeArray || ['', '', '', null, null, null, null, null, null, ''], null, null, null, [1], 1, null, null, 1, 0, null, null, null, null, null, [[0]], 1, null, null, null, null, null, ['', '', savedInstruction, null, null, null, null, null, 0, null, 1, null, null, null, []], null, null, 1, null, null, null, null, null, null, null, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], 1, null, null, null, null, [1]];
    const { data } = await axios.post('https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=boq_assistant-bard-web-server_20250729.06_p0&f.sid=4206607810970164620&hl=en-US&_reqid=2813378&rt=c', new URLSearchParams({ 'f.req': JSON.stringify([null, JSON.stringify(requestBody)]) }).toString(), { headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', 'x-goog-ext-525001261-jspb': '[1,null,null,null,"9ec249fc9ad08861",null,null,null,[4]]', cookie } });
    const match = Array.from(data.matchAll(/^\d+\n(.+?)\n/gm)); const array = match.reverse();
    const realArray = JSON.parse(JSON.parse(array[3][1])[0][2]); const parse1 = realArray;
    const newResumeArray = [...parse1[1], parse1[4][0][0]];
    const text = parse1[4][0][1][0].replace(/\*\*(.+?)\*\*/g, '*$1*');
    const newSessionId = Buffer.from(JSON.stringify({ resumeArray: newResumeArray, cookie, instruction: savedInstruction })).toString('base64');
    sendSuccessResponse(res, { text, sessionId: newSessionId });
}

router.metadata = [
    { name: 'Gemini (Cookie)', path: '/api/ai/gemini', methods: ['GET', 'POST'], category: 'AI', description: 'Chat Gemini dengan session support dan custom instruction.', params: [{ name: 'message', type: 'string', required: true }, { name: 'instruction', type: 'string', required: false }, { name: 'sessionId', type: 'string', required: false }] },
];

module.exports = router;
