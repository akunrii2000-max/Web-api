'use strict';

const { Router } = require('express');
const axios      = require('axios');
const cheerio    = require('cheerio');
const { uniqueNamesGenerator, adjectives, animals } = require('unique-names-generator');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

class AkunLama {
    constructor() {
        this.inst = axios.create({ baseURL: 'https://akunlama.com/api/v1', headers: { origin: 'https://akunlama.com', referer: 'https://akunlama.com/inbox', 'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958) AppleWebKit/537.36 Chrome/130.0.6723.86 Mobile Safari/537.36' } });
    }
    async get(prefix) {
        if (!prefix) prefix = uniqueNamesGenerator({ dictionaries: [adjectives, animals], separator: '', length: 2, style: 'lowerCase' }) + Math.floor(Math.random() * 1000);
        const { data } = await this.inst.get(`/mail/list?recipient=${prefix}`);
        if (!data || data.length === 0) return { email: `${prefix}@akunlama.com`, emails: [] };
        const emails = await Promise.all(data.map(async mail => {
            const { data: html } = await this.inst.get(`/mail/getHtml?region=${mail.storage.region}&key=${mail.storage.key}`);
            const $ = cheerio.load(html); $('script, style').remove();
            return { subject: mail.message.headers.subject, from: mail.message.headers.from, text: $('body').text().replace(/\s+/g, ' ').trim(), timestamp: mail.timestamp };
        }));
        return { email: `${prefix}@akunlama.com`, emails };
    }
}
const akunLama = new AkunLama();

router.get('/api/scraper/akunlama', asyncHandler(async (req, res) => { sendSuccessResponse(res, await akunLama.get(req.query.prefix)); }));
router.post('/api/scraper/akunlama', asyncHandler(async (req, res) => { sendSuccessResponse(res, await akunLama.get(req.body.prefix)); }));

router.metadata = [
    { name: 'AkunLama TempMail ID', path: '/api/scraper/akunlama', methods: ['GET', 'POST'], category: 'TEMP MAIL', description: 'Ambil inbox email sementara (akunlama.com). Kalau tanpa prefix, auto-generate.', params: [{ name: 'prefix', type: 'string', required: false }] },
];

module.exports = router;
