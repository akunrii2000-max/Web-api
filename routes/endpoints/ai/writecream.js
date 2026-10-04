'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

router.get('/api/ai/writecream/chat', asyncHandler(async (req, res) => {
    const { question, logic } = req.query;
    if (!question) throw new ValidationError('Parameter "question" wajib diisi.');
    const { data } = await axios.get('https://8pe3nv3qha.execute-api.us-east-1.amazonaws.com/default/llm_chat', {
        params: { query: JSON.stringify([...(logic ? [{ role: 'system', content: logic }] : []), { role: 'user', content: question }]), link: 'writecream.com' }
    });
    sendSuccessResponse(res, { response: data.response_content });
}));

router.post('/api/ai/writecream/chat', asyncHandler(async (req, res) => {
    const { question, logic } = req.body;
    if (!question) throw new ValidationError('Parameter "question" wajib diisi.');
    const { data } = await axios.get('https://8pe3nv3qha.execute-api.us-east-1.amazonaws.com/default/llm_chat', {
        params: { query: JSON.stringify([...(logic ? [{ role: 'system', content: logic }] : []), { role: 'user', content: question }]), link: 'writecream.com' }
    });
    sendSuccessResponse(res, { response: data.response_content });
}));

router.get('/api/ai/writecream/image', asyncHandler(async (req, res) => {
    const ratios = ['1:1', '16:9', '2:3', '3:2', '4:5', '5:4', '9:16', '21:9', '9:21'];
    const { prompt, ratio = '1:1' } = req.query;
    if (!prompt) throw new ValidationError('Parameter "prompt" wajib diisi.');
    if (!ratios.includes(ratio)) throw new ValidationError(`Available ratios: ${ratios.join(', ')}.`);
    const { data } = await axios.get('https://1yjs1yldj7.execute-api.us-east-1.amazonaws.com/default/ai_image', { params: { prompt, aspect_ratio: ratio, link: 'writecream.com' } });
    sendSuccessResponse(res, { url: data.image_link });
}));

router.post('/api/ai/writecream/image', asyncHandler(async (req, res) => {
    const ratios = ['1:1', '16:9', '2:3', '3:2', '4:5', '5:4', '9:16', '21:9', '9:21'];
    const { prompt, ratio = '1:1' } = req.body;
    if (!prompt) throw new ValidationError('Parameter "prompt" wajib diisi.');
    if (!ratios.includes(ratio)) throw new ValidationError(`Available ratios: ${ratios.join(', ')}.`);
    const { data } = await axios.get('https://1yjs1yldj7.execute-api.us-east-1.amazonaws.com/default/ai_image', { params: { prompt, aspect_ratio: ratio, link: 'writecream.com' } });
    sendSuccessResponse(res, { url: data.image_link });
}));

router.metadata = [
    { name: 'WriteCream Chat', path: '/api/ai/writecream/chat', methods: ['POST'], category: 'AI', description: 'Chat AI via WriteCream.', params: [{ name: 'question', type: 'string', required: true }, { name: 'logic', type: 'string', required: false }] },
    { name: 'WriteCream Image', path: '/api/ai/writecream/image', methods: ['POST'], category: 'AI', description: 'Generate gambar AI via WriteCream.', params: [{ name: 'prompt', type: 'string', required: true }, { name: 'ratio', type: 'string', required: false }] },
];

module.exports = router;
