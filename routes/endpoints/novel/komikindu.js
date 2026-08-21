'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

class KomikIndo {
    constructor() {
        this.client = axios.create({ baseURL: 'https://kmkindo.click', headers: { 'accept-encoding': 'gzip', connection: 'Keep-Alive', host: 'kmkindo.click', 'user-agent': 'Dalvik/2.1.0 (Linux; U; Android 10; Redmi Note 4 Build/QQ3A.200905.001)' } });
        this.regex = /^https?:\/\/kmkindo\.click\/?\?.*?page=(manga|chapter).*?id=(\d+)/;
    }
    async fetch(url) { const { data } = await this.client(url).catch(e => { throw new Error(e.message); }); return data; }
    async search(query, page = '1') {
        if (!query) throw new ValidationError('Query is required.');
        return this.fetch(`?page=search&search=${query}&paged=${page}`);
    }
    async detail(url) {
        const match = url?.match(this.regex);
        if (!match || match[1] !== 'manga') throw new ValidationError('Invalid manga URL.');
        return this.fetch(`?page=manga&id=${match[2]}`);
    }
    async chapter(url) {
        const match = url?.match(this.regex);
        if (!match || match[1] !== 'chapter') throw new ValidationError('Invalid chapter URL.');
        return this.fetch(`?page=chapter&id=${match[2]}`);
    }
}
const komikIndo = new KomikIndo();

router.get('/api/scraper/komikindu/search', asyncHandler(async (req, res) => { sendSuccessResponse(res, await komikIndo.search(req.query.q, req.query.page)); }));
router.post('/api/scraper/komikindu/search', asyncHandler(async (req, res) => { sendSuccessResponse(res, await komikIndo.search(req.body.q, req.body.page)); }));
router.get('/api/scraper/komikindu/detail', asyncHandler(async (req, res) => { sendSuccessResponse(res, await komikIndo.detail(req.query.url)); }));
router.post('/api/scraper/komikindu/detail', asyncHandler(async (req, res) => { sendSuccessResponse(res, await komikIndo.detail(req.body.url)); }));
router.get('/api/scraper/komikindu/chapter', asyncHandler(async (req, res) => { sendSuccessResponse(res, await komikIndo.chapter(req.query.url)); }));
router.post('/api/scraper/komikindu/chapter', asyncHandler(async (req, res) => { sendSuccessResponse(res, await komikIndo.chapter(req.body.url)); }));

router.metadata = [
    { name: 'KomikIndo Search', path: '/api/scraper/komikindu/search', methods: ['GET', 'POST'], category: 'NOVEL & KOMIK', description: 'Cari komik di KomikIndo.', params: [{ name: 'q', type: 'string', required: true }] },
    { name: 'KomikIndo Detail', path: '/api/scraper/komikindu/detail', methods: ['GET', 'POST'], category: 'NOVEL & KOMIK', description: 'Detail manga/komik dari KomikIndo.', params: [{ name: 'url', type: 'string', required: true }] },
    { name: 'KomikIndo Chapter', path: '/api/scraper/komikindu/chapter', methods: ['GET', 'POST'], category: 'NOVEL & KOMIK', description: 'Baca chapter manga dari KomikIndo.', params: [{ name: 'url', type: 'string', required: true }] },
];

module.exports = router;
