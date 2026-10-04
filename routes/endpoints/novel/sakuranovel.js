'use strict';

const { Router } = require('express');
const axios      = require('axios');
const cheerio    = require('cheerio');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

class SakuraNovel {
    async getHTML(url, options = {}) {
        const { method = 'GET', data = null, headers = {} } = options;
        const config = { method: method.toLowerCase(), url: `https://cloudflare-cors-anywhere.supershadowcube.workers.dev/?url=${url}`, headers };
        if (method.toUpperCase() === 'POST' && data) config.data = data;
        const { data: html } = await axios(config);
        return cheerio.load(html);
    }
    async search(query) {
        if (!query) throw new ValidationError('Parameter "query" wajib diisi.');
        const $ = await this.getHTML('https://sakuranovel.id/wp-admin/admin-ajax.php', { methods: ['POST'], data: new URLSearchParams({ action: 'data_fetch', keyword: query }).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', origin: 'https://sakuranovel.id', referer: 'https://sakuranovel.id/' } });
        return $('.searchbox').map((_, el) => ({ title: $(el).find('.searchbox-title').text().trim(), cover: $(el).find('.searchbox-thumb img').attr('src')?.replace('i0.wp.com/', '')?.split('?')[0], type: $(el).find('.type').text().trim(), status: $(el).find('.status').text().trim(), url: $(el).find('a').attr('href') })).get();
    }
    async detail(url) {
        if (!/^https:\/\/sakuranovel\.id\/series\/[\w-]+\/?$/.test(url)) throw new ValidationError('Invalid detail URL.');
        const $ = await this.getHTML(url);
        return { title: $('.series-titlex h2').text().trim(), cover: $('.series-thumb img').attr('src'), type: $('.series-infoz.block .type').text().trim(), status: $('.series-infoz.block .status').text().trim(), rating: $('.series-infoz.score span[itemprop="ratingValue"]').text().trim(), genres: $('.series-genres a').map((_, el) => $(el).text().trim()).get(), synopsis: $('.series-synops p').map((_, el) => $(el).text().trim()).get().join('\n\n'), chapters: $('.series-chapterlists li').map((_, el) => { const a = $(el).find('.flexch-infoz a'); return { title: a.find('span').first().text().trim(), url: a.attr('href'), date: a.find('.date').text().trim() }; }).get() };
    }
    async chapter(url) {
        if (!/^https:\/\/sakuranovel\.id\/(?!series\/)[\w-]+\d+[\w-]*\/?$/.test(url)) throw new ValidationError('Invalid chapter URL.');
        const $ = await this.getHTML(url);
        const container = $('.tldariinggrissendiribrojangancopy');
        const images = container.find('img').map((_, el) => { let src = $(el).attr('src') || $(el).attr('data-src'); return src ? src.split('?')[0] : null; }).get().filter(Boolean);
        const text = container.find('p').map((_, el) => { const t = $(el).text().trim(); return t && !t.includes('sakuranovel') ? t : null; }).get().filter(Boolean).join('\n\n');
        return { chapter_info: $('h2.title-chapter').text().trim(), content: text || null, images: images.length ? images : null, navigation: { prev: $('.entry-pagination .pagi-prev a').attr('href') || null, toc: $('.entry-pagination .pagi-toc a').attr('href') || null, next: $('.entry-pagination .pagi-next a').attr('href') || null } };
    }
}
const sakuraNovel = new SakuraNovel();

router.get('/api/scraper/sakuranovel/search', asyncHandler(async (req, res) => { sendSuccessResponse(res, await sakuraNovel.search(req.query.q || req.query.query)); }));
router.post('/api/scraper/sakuranovel/search', asyncHandler(async (req, res) => { sendSuccessResponse(res, await sakuraNovel.search(req.body.q || req.body.query)); }));
router.get('/api/scraper/sakuranovel/detail', asyncHandler(async (req, res) => { sendSuccessResponse(res, await sakuraNovel.detail(req.query.url)); }));
router.post('/api/scraper/sakuranovel/detail', asyncHandler(async (req, res) => { sendSuccessResponse(res, await sakuraNovel.detail(req.body.url)); }));
router.get('/api/scraper/sakuranovel/chapter', asyncHandler(async (req, res) => { sendSuccessResponse(res, await sakuraNovel.chapter(req.query.url)); }));
router.post('/api/scraper/sakuranovel/chapter', asyncHandler(async (req, res) => { sendSuccessResponse(res, await sakuraNovel.chapter(req.body.url)); }));

router.metadata = [
    { name: 'SakuraNovel Search', path: '/api/scraper/sakuranovel/search', methods: ['GET', 'POST'], category: 'NOVEL & KOMIK', description: 'Cari novel di SakuraNovel.', params: [{ name: 'q', type: 'string', required: true }] },
    { name: 'SakuraNovel Detail', path: '/api/scraper/sakuranovel/detail', methods: ['GET', 'POST'], category: 'NOVEL & KOMIK', description: 'Detail novel dari SakuraNovel.', params: [{ name: 'url', type: 'string', required: true }] },
    { name: 'SakuraNovel Chapter', path: '/api/scraper/sakuranovel/chapter', methods: ['GET', 'POST'], category: 'NOVEL & KOMIK', description: 'Baca chapter novel dari SakuraNovel.', params: [{ name: 'url', type: 'string', required: true }] },
];

module.exports = router;
