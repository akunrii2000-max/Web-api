'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

function normalizeContents(input) {
    if (!input) return null;
    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed;
            } catch (_) {  }
        }
        return [{ role: 'user', parts: [{ text: input }] }];
    }
    if (Array.isArray(input)) return input;
    return null;
}

class GeminiApi {
    constructor() { this.authToken = null; this.tokenExpiry = null; }

    async getAuthToken() {
        if (this.authToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 300000) return this.authToken;
        const { data } = await axios.post(
            'https://www.googleapis.com/identitytoolkit/v3/relyingparty/signupNewUser?key=AIzaSyAxof8_SbpDcww38NEQRhNh0Pzvbphh-IQ',
            { clientType: 'CLIENT_TYPE_ANDROID' },
            { headers: {
                'accept-language': 'in-ID, en-US', 'content-type': 'application/json',
                'user-agent': 'Dalvik/2.1.0 (Linux; U; Android 10; SM-J700F Build/QQ3A.200805.001)',
                'x-android-cert': '037CD2976D308B4EFD63EC63C48DC6E7AB7E5AF2',
                'x-android-package': 'com.jetkite.gemmy',
                'x-client-version': 'Android/Fallback/X24000001/FirebaseCore-Android',
                'x-firebase-appcheck': 'eyJlcnJvciI6IlVOS05PV05fRVJST1IifQ==',
                'x-firebase-gmpid': '1:652803432695:android:c4341db6033e62814f33f2',
            } }
        );
        if (!data.idToken) throw new Error('Gagal mendapatkan auth token Gemini.');
        this.authToken  = data.idToken;
        this.tokenExpiry = Date.now() + 3600000;
        return this.authToken;
    }

    async chat({ contents, model = 'gemini-flash-latest', ...config }) {

        const authToken = await this.getAuthToken();
        const { data } = await axios.post(
            'https://asia-northeast3-gemmy-ai-bdc03.cloudfunctions.net/gemini',
            { model, stream: false, request: { contents, generationConfig: { maxOutputTokens: 8192, ...config } } },
            { headers: { 'accept-encoding': 'gzip', authorization: `Bearer ${authToken}`, 'content-type': 'application/json; charset=UTF-8', 'user-agent': 'okhttp/5.3.2' } }
        );
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Gemini mengembalikan respons kosong.');
        return text;
    }
}

const geminiApi = new GeminiApi();

router.get('/api/ai/gemini-api', asyncHandler(async (req, res) => {
    const { text, contents: contentsParam, model, ...config } = req.query;
    const raw = text || contentsParam;
    if (!raw) throw new ValidationError('Parameter "text" wajib diisi.');
    const contents = normalizeContents(raw);
    if (!contents) throw new ValidationError('Parameter "text" tidak valid.');
    const result = await geminiApi.chat({ contents, model, ...config });
    sendSuccessResponse(res, { response: result });
}));

router.post('/api/ai/gemini-api', asyncHandler(async (req, res) => {
    const { text, contents: contentsParam, model, ...config } = req.body;
    const raw = text || contentsParam;
    if (!raw) throw new ValidationError('Parameter "text" wajib diisi.');
    const contents = normalizeContents(raw);
    if (!contents) throw new ValidationError('Parameter "text" tidak valid.');
    const result = await geminiApi.chat({ contents, model, ...config });
    sendSuccessResponse(res, { response: result });
}));

router.metadata = [
    {
        name: 'Gemini API',
        path: '/api/ai/gemini-api',
        methods: ['GET', 'POST'],
        category: 'AI',
        description: 'Chat dengan Gemini AI via Gemmy API. Cukup kirim teks biasa.',
        params: [
            {
                name: 'text', type: 'text', required: true,
                placeholder: 'Halo! Ceritakan tentang AI.',
                description: 'Pesan yang dikirim ke Gemini (juga bisa pakai param: contents)',
            },
            {
                name: 'model', type: 'text', required: false, default: 'gemini-flash-latest', placeholder: 'gemini-flash-latest',
                description: 'Gemini model yang digunakan',
                options: [
                    { value: 'gemini-flash-latest',       label: 'Gemini Flash Latest (default)' },
                    { value: 'gemini-2.0-flash',          label: 'Gemini 2.0 Flash' },
                    { value: 'gemini-2.5-flash-preview',  label: 'Gemini 2.5 Flash Preview' },
                    { value: 'gemini-2.5-pro-preview',    label: 'Gemini 2.5 Pro Preview' },
                    { value: 'gemini-1.5-flash',          label: 'Gemini 1.5 Flash' },
                    { value: 'gemini-1.5-pro',            label: 'Gemini 1.5 Pro' },
                ],
            },
        ],
    },
];

module.exports = router;
