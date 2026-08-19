'use strict';

const { Router } = require('express');
const axios      = require('axios');
const cheerio    = require('cheerio');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

class Otakudesu {
    constructor() {
        this.inst = axios.create({ baseURL: 'https://uncors.netlify.app/', params: { destination: 'https://otakudesu.best' } });
    }
    async _fetch(path) {
        const { data } = await this.inst.get('', { params: { destination: `https://otakudesu.best${path}` } });
        return cheerio.load(data);
    }
    _mapGenres(html) { return html.split('</a>').filter(i => i.trim()).map(i => cheerio.load(`${i}</a>`)('a').text()); }
    _splitElements(html, delimiter = '</li>') { return html.split(delimiter).filter(i => i.trim()).map(i => `${i}${delimiter}`); }

    async ongoing(page = 1) {
        if (isNaN(page)) throw new ValidationError('Page must be a number.');
        const $ = await this._fetch(`/ongoing-anime/page/${page}`);
        return { ongoing: this._splitElements($('.venutama .rseries .rapi .venz ul li').toString()).map(anime => { const $a = cheerio.load(anime); return { title: $a('.detpost .thumb .thumbz .jdlflm').text(), cover: $a('.detpost .thumb .thumbz img').attr('src'), current_episode: $a('.detpost .epz').text().trim(), release_day: $a('.detpost .epztipe').text().trim(), url: $a('.detpost .thumb a').attr('href') }; }) };
    }
    async complete(page = 1) {
        if (isNaN(page)) throw new ValidationError('Page must be a number.');
        const $ = await this._fetch(`/complete-anime/page/${page}`);
        return { complete: this._splitElements($('.venutama .rseries .rapi .venz ul li').toString()).map(anime => { const $a = cheerio.load(anime); return { title: $a('.detpost .thumb .thumbz .jdlflm').text(), cover: $a('.detpost .thumb .thumbz img').attr('src'), episode_count: $a('.detpost .epz').text().trim().replace(' Episode', ''), url: $a('.detpost .thumb a').attr('href') }; }) };
    }
    async search(query) {
        if (!query) throw new ValidationError('Query is required.');
        const $ = await this._fetch(`/?s=${query}&post_type=anime`);
        return this._splitElements($('.chivsrc li').toString()).map(anime => { const $a = cheerio.load(anime); return { title: $a('h2 a').text().replace(/\bsub(?:title)?[\s-]?(indo(?:nesia)?)\b/gi, '').trim(), cover: $a('img').attr('src'), genres: this._mapGenres($a('.set:nth-child(3)')?.html()?.replace('<b>Genres</b> : ', '') || ''), status: $a('.set:nth-child(4)').text()?.replace('Status : ', ''), url: $a('h2 a').attr('href') }; });
    }
    async detail(url) {
        if (!url.includes('otakudesu.best')) throw new ValidationError('Invalid URL.');
        const $ = await cheerio.load((await this.inst.get('', { params: { destination: url } })).data);
        const getText = (sel, rep = '') => $(sel).text()?.replace(rep, '');
        const $ep = cheerio.load(`<div>${$('.episodelist').toString()}</div>`);
        const list = this._splitElements($ep('.episodelist:nth-child(2) ul').html() || '', '</li>');
        if (!list.length) throw new ValidationError('No episode list found.', 404);
        const episode_lists = list.map(ep => { const $e = cheerio.load(ep); const title = $e('li span:first a')?.text(); const epNum = title?.replace(/^.*Episode\s+/, '').replace(/\D.*$/, '').trim(); return { episode: title.trim(), episode_number: epNum ? parseInt(epNum, 10) : undefined, url: $e('li span:first a')?.attr('href') }; }).reverse();
        return { title: getText('.infozin .infozingle p:first span', 'Judul: '), cover: $('.fotoanime img').attr('src'), rating: getText('.infozin .infozingle p:nth-child(3) span', 'Skor: '), type: getText('.infozin .infozingle p:nth-child(5) span', 'Tipe: '), status: getText('.infozin .infozingle p:nth-child(6) span', 'Status: '), genres: this._mapGenres($('.infozin .infozingle p:last span a').toString()), synopsis: $('.sinopc').text(), episode_lists };
    }
    async schedule() {
        const $ = await this._fetch('/jadwal-rilis');
        return $('.kglist321').map((i, el) => ({ day: $(el).find('h2').text().trim(), anime_list: $(el).find('ul > li').map((j, li) => ({ anime_name: $(li).find('a').text().trim(), url: $(li).find('a').attr('href') ?? '' })).get() })).get();
    }
}
const otakudesu = new Otakudesu();

router.get('/api/scraper/otakudesu/ongoing', asyncHandler(async (req, res) => { sendSuccessResponse(res, await otakudesu.ongoing(req.query.page)); }));
router.get('/api/scraper/otakudesu/complete', asyncHandler(async (req, res) => { sendSuccessResponse(res, await otakudesu.complete(req.query.page)); }));
router.get('/api/scraper/otakudesu/schedule', asyncHandler(async (req, res) => { sendSuccessResponse(res, await otakudesu.schedule()); }));
router.get('/api/scraper/otakudesu/search', asyncHandler(async (req, res) => { sendSuccessResponse(res, await otakudesu.search(req.query.q)); }));
router.post('/api/scraper/otakudesu/search', asyncHandler(async (req, res) => { sendSuccessResponse(res, await otakudesu.search(req.body.q)); }));
router.get('/api/scraper/otakudesu/detail', asyncHandler(async (req, res) => { sendSuccessResponse(res, await otakudesu.detail(req.query.url)); }));
router.post('/api/scraper/otakudesu/detail', asyncHandler(async (req, res) => { sendSuccessResponse(res, await otakudesu.detail(req.body.url)); }));

router.metadata = [
    { name: 'Otakudesu Ongoing', path: '/api/scraper/otakudesu/ongoing', methods: ['GET'], category: 'ANIME', description: 'Daftar anime ongoing dari Otakudesu.', params: [{ name: 'page', type: 'number', required: false }] },
    { name: 'Otakudesu Complete', path: '/api/scraper/otakudesu/complete', methods: ['GET'], category: 'ANIME', description: 'Daftar anime complete dari Otakudesu.', params: [{ name: 'page', type: 'number', required: false }] },
    { name: 'Otakudesu Search', path: '/api/scraper/otakudesu/search', methods: ['GET', 'POST'], category: 'ANIME', description: 'Cari anime di Otakudesu.', params: [{ name: 'q', type: 'string', required: true }] },
    { name: 'Otakudesu Detail', path: '/api/scraper/otakudesu/detail', methods: ['GET', 'POST'], category: 'ANIME', description: 'Detail anime + episode list dari Otakudesu.', params: [{ name: 'url', type: 'string', required: true }] },
    { name: 'Otakudesu Schedule', path: '/api/scraper/otakudesu/schedule', methods: ['GET'], category: 'ANIME', description: 'Jadwal rilis anime dari Otakudesu.', params: [] },
];

module.exports = router;
