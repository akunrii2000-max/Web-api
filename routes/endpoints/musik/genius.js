'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

class GeniusScraper {
    constructor() {
        this.inst = axios.create({ baseURL: 'https://api.genius.com', headers: { 'user-agent': 'Genius/8.0.5.4987 (Android; Android 10; samsung SM-J700F)', 'x-genius-app-background-request': '0', 'x-genius-logged-out': 'true', 'x-genius-android-version': '8.0.5.4987' } });
    }
    async search(query) {
        if (!query) throw new ValidationError('Parameter "query" wajib diisi.');
        const { data } = await this.inst.get('/search/multi', { params: { q: query } });
        return data?.response?.sections?.find(s => s.type === 'song')?.hits || [];
    }
    async detail(id) {
        if (!id || isNaN(id)) throw new ValidationError('Parameter "id" (song ID) wajib diisi.');
        const { data } = await this.inst.get(`/songs/${id}`);
        return data?.response?.song || data;
    }
}
const genius = new GeniusScraper();

router.get('/api/scraper/genius/search', asyncHandler(async (req, res) => { sendSuccessResponse(res, await genius.search(req.query.q || req.query.query)); }));
router.post('/api/scraper/genius/search', asyncHandler(async (req, res) => { sendSuccessResponse(res, await genius.search(req.body.q || req.body.query)); }));
router.get('/api/scraper/genius/detail', asyncHandler(async (req, res) => { sendSuccessResponse(res, await genius.detail(req.query.id)); }));
router.post('/api/scraper/genius/detail', asyncHandler(async (req, res) => { sendSuccessResponse(res, await genius.detail(req.body.id)); }));

router.metadata = [
    { name: 'Genius Search', path: '/api/scraper/genius/search', methods: ['GET', 'POST'], category: 'MUSIK', description: 'Cari lagu di Genius.', params: [{ name: 'q', type: 'string', required: true }] },
    { name: 'Genius Detail', path: '/api/scraper/genius/detail', methods: ['GET', 'POST'], category: 'MUSIK', description: 'Detail lagu dari Genius (by song ID).', params: [{ name: 'id', type: 'string', required: true }] },
];

module.exports = router;
