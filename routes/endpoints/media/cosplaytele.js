'use strict';

const { Router } = require('express');
const axios      = require('axios');
const cheerio    = require('cheerio');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

class CosplayTele {
    constructor() { this.proxy = 'https://uncors.netlify.app/?destination='; this.base = 'https://cosplaytele.com'; }
    async search(query, page = 1) {
        if (!query) throw new ValidationError('Query is required.');
        const { data } = await axios.get(`${this.proxy}${this.base}/?s=${encodeURIComponent(query)}&paged=${page}`);
        const $ = cheerio.load(data);
        return $('.posts-grid article').map((_, el) => ({ title: $(el).find('.entry-title a').text().trim(), cover: $(el).find('img').attr('src'), url: $(el).find('.entry-title a').attr('href') })).get();
    }
    async detail(url) {
        if (!url.includes('cosplaytele.com')) throw new ValidationError('Invalid URL.');
        const { data } = await axios.get(`${this.proxy}${url}`);
        const $ = cheerio.load(data);
        const images = []; $('figure img').each((_, el) => { const src = $(el).attr('src'); if (src) images.push(src); });
        return { title: $('h1.entry-title').text().trim(), images };
    }
}
const cosplayTele = new CosplayTele();

router.get('/api/scraper/cosplaytele/search', asyncHandler(async (req, res) => { sendSuccessResponse(res, await cosplayTele.search(req.query.q, req.query.page)); }));
router.post('/api/scraper/cosplaytele/search', asyncHandler(async (req, res) => { sendSuccessResponse(res, await cosplayTele.search(req.body.q, req.body.page)); }));
router.get('/api/scraper/cosplaytele/detail', asyncHandler(async (req, res) => { sendSuccessResponse(res, await cosplayTele.detail(req.query.url)); }));
router.post('/api/scraper/cosplaytele/detail', asyncHandler(async (req, res) => { sendSuccessResponse(res, await cosplayTele.detail(req.body.url)); }));

router.metadata = [
    { name: 'CosplayTele Search', path: '/api/scraper/cosplaytele/search', methods: ['GET', 'POST'], category: 'MEDIA', description: 'Cari post cosplay dari CosplayTele.', params: [{ name: 'q', type: 'string', required: true }] },
    { name: 'CosplayTele Detail', path: '/api/scraper/cosplaytele/detail', methods: ['GET', 'POST'], category: 'MEDIA', description: 'Detail post cosplay dari CosplayTele.', params: [{ name: 'url', type: 'string', required: true }] },
];

module.exports = router;
