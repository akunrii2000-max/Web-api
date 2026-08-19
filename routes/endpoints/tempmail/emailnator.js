'use strict';

const { Router } = require('express');
const axios      = require('axios');
const cheerio    = require('cheerio');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

class Emailnator {
    constructor() {
        this.jar = new CookieJar();
        this.client = wrapper(axios.create({ jar: this.jar, baseURL: 'https://www.emailnator.com', headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36', Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json', 'x-requested-with': 'XMLHttpRequest', origin: 'https://www.emailnator.com', 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty', 'accept-language': 'id,ms;q=0.9,en;q=0.8' } }));
    }
    async getToken() {
        const cookies = await this.jar.getCookies('https://www.emailnator.com');
        const xsrf = cookies.find(c => c.key === 'XSRF-TOKEN');
        return xsrf?.value ? decodeURIComponent(xsrf.value) : '';
    }
    async create() {
        await this.client.get('/');
        const xsrfToken = await this.getToken();
        if (!xsrfToken) throw new Error('Failed to get XSRF token');
        const { data } = await this.client.post('/generate-email', { email: ['plusGmail', 'dotGmail'] }, { headers: { 'x-xsrf-token': xsrfToken, referer: 'https://www.emailnator.com/' } });
        return { email: data.email[0] };
    }
    async getInbox(email) {
        if (!email) throw new ValidationError('Parameter "email" wajib diisi.');
        await this.client.get('/');
        const xsrfToken = await this.getToken();
        if (!xsrfToken) throw new Error('XSRF token not found');
        const { data: res } = await this.client.post('/message-list', { email }, { headers: { 'x-xsrf-token': xsrfToken, referer: 'https://www.emailnator.com/mailbox/' } });
        const emails = [];
        if (res.messageData?.length) {
            const resolved = await Promise.all(res.messageData.filter(m => m.messageID !== 'ADSVPN').map(async m => {
                const { data } = await this.client.post('/message-list', { email, messageID: m.messageID }, { headers: { 'x-xsrf-token': xsrfToken, referer: 'https://www.emailnator.com/mailbox/' } });
                const $ = cheerio.load(data); $('style,script,img').remove();
                return { id: m.messageID, from: m.from, subject: m.subject, text: $('body').text().replace(/\s+/g, ' ').trim(), time: m.time };
            }));
            emails.push(...resolved);
        }
        return { totalEmails: emails.length, emails };
    }
}
const emailnator = new Emailnator();

router.post('/api/scraper/emailnator/create', asyncHandler(async (req, res) => { sendSuccessResponse(res, await emailnator.create()); }));
router.get('/api/scraper/emailnator/inbox', asyncHandler(async (req, res) => { sendSuccessResponse(res, await emailnator.getInbox(req.query.email)); }));
router.post('/api/scraper/emailnator/inbox', asyncHandler(async (req, res) => { sendSuccessResponse(res, await emailnator.getInbox(req.body.email)); }));

router.metadata = [
    { name: 'Emailnator Create', path: '/api/scraper/emailnator/create', methods: ['POST'], category: 'TEMP MAIL', description: 'Buat email sementara via Emailnator.', params: [] },
    { name: 'Emailnator Inbox', path: '/api/scraper/emailnator/inbox', methods: ['GET', 'POST'], category: 'TEMP MAIL', description: 'Cek inbox email sementara Emailnator.', params: [{ name: 'email', type: 'string', required: true }] },
];

module.exports = router;
