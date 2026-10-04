'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

const stickerlyHeaders = {
    'user-agent': 'androidapp.stickerly/3.17.0 (Redmi Note 4; U; Android 29; in-ID; id;)',
    'content-type': 'application/json',
    'accept-encoding': 'gzip'
};

router.get('/api/scraper/stickerly/search', asyncHandler(async (req, res) => { await handleSearch(req.query, res); }));
router.post('/api/scraper/stickerly/search', asyncHandler(async (req, res) => { await handleSearch(req.body, res); }));
router.get('/api/scraper/stickerly/detail', asyncHandler(async (req, res) => { await handleDetail(req.query, res); }));
router.post('/api/scraper/stickerly/detail', asyncHandler(async (req, res) => { await handleDetail(req.body, res); }));

async function handleSearch({ query }, res) {
    if (!query) throw new ValidationError('Parameter "query" wajib diisi.');
    const { data } = await axios.post('https://api.sticker.ly/v4/stickerPack/smartSearch', { keyword: query, enabledKeywordSearch: true, filter: { extendSearchResult: false, sortBy: 'RECOMMENDED', languages: ['ALL'], minStickerCount: 5, searchBy: 'ALL', stickerType: 'ALL' } }, { headers: stickerlyHeaders });
    sendSuccessResponse(res, { results: data.result.stickerPacks.map(p => ({ name: p.name, author: p.authorName, stickerCount: p.resourceFiles.length, viewCount: p.viewCount, exportCount: p.exportCount, isAnimated: p.isAnimated, thumbnail: `${p.resourceUrlPrefix}${p.resourceFiles[p.trayIndex]}`, url: p.shareUrl })) });
}

async function handleDetail({ url }, res) {
    const match = url?.match(/\/s\/([^\/\?#]+)/);
    if (!match) throw new ValidationError('URL Sticker.ly tidak valid.');
    const { data } = await axios.get(`https://api.sticker.ly/v4/stickerPack/${match[1]}?needRelation=true`, { headers: stickerlyHeaders });
    sendSuccessResponse(res, { name: data.result.name, author: { name: data.result.user.displayName, username: data.result.user.userName, avatar: data.result.user.profileUrl }, stickers: data.result.stickers.map(s => ({ fileName: s.fileName, isAnimated: s.isAnimated, imageUrl: `${data.result.resourceUrlPrefix}${s.fileName}` })), viewCount: data.result.viewCount, url: data.result.shareUrl });
}

router.metadata = [
    { name: 'StickerLy Search', path: '/api/scraper/stickerly/search', methods: ['GET', 'POST'], category: 'MEDIA', description: 'Cari sticker pack di Sticker.ly.', params: [{ name: 'query', type: 'string', required: true }] },
    { name: 'StickerLy Detail', path: '/api/scraper/stickerly/detail', methods: ['GET', 'POST'], category: 'MEDIA', description: 'Detail sticker pack dari Sticker.ly.', params: [{ name: 'url', type: 'string', required: true }] },
];

module.exports = router;
