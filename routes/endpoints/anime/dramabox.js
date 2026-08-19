'use strict';

const { Router } = require('express');
const axios      = require('axios');
const cheerio    = require('cheerio');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse }                     = require('../../../config/apikeyConfig');

const router  = Router();
const BASE    = 'https://www.dramaboxdb.com';
const HEADERS = {
  'User-Agent'     : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Accept'         : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
};

async function search(query) {
  const { data } = await axios.get(`${BASE}/in/search`, { params: { searchValue: query }, headers: HEADERS });
  const $       = cheerio.load(data);
  const results = [];
  $('.SearchBookList_imageItem1Wrap__dvPmc').each((_, el) => {
    results.push({
      title: $(el).find('a').text().trim(),
      url  : BASE + ($(el).find('a').attr('href') || ''),
      image: $(el).find('img').attr('src') || null,
    });
  });
  return { query, total: results.length, results };
}

async function getEpisodes(url) {
  const { data } = await axios.get(url, { headers: HEADERS });
  const $        = cheerio.load(data);
  const episodes = [];
  $('.relatedEpisode_listItem__PNXFG').each((_, el) => {
    if (($(el).attr('style') || '').includes('display:none')) return;
    const link = $(el).find('a.relatedEpisode_rightIntro__y7zZA');
    episodes.push({
      title  : link.find('.relatedEpisode_title__eygbR').text().trim(),
      episode: link.find('.relatedEpisode_pageNum__W_ulP').text().trim(),
      url    : BASE + (link.attr('href') || ''),
    });
  });
  return episodes;
}

async function handle(params, res) {
  const { url, query, q } = params;
  if (url) {
    if (!validate.url(url)) throw new ValidationError('URL tidak valid.');
    const episodes = await getEpisodes(url.trim());
    return sendSuccessResponse(res, { url, total: episodes.length, episodes });
  }
  const kw = query || q;
  if (!kw) throw new ValidationError('Parameter "query" atau "url" wajib diisi.');
  sendSuccessResponse(res, await search(kw.trim()));
}

router.get('/api/anime/dramabox',  asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/anime/dramabox', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = {
  name       : 'DramaBox',
  path       : '/api/anime/dramabox',
  methods    : ['GET', 'POST'],
  category   : 'ANIME',
  description: 'Cari drama di DramaBox atau ambil daftar episode dari URL drama.',
  params     : [
    { name: 'query', type: 'string', required: false, description: 'Judul drama yang dicari' },
    { name: 'url',   type: 'string', required: false, description: 'URL drama untuk daftar episode' },
  ],
};

module.exports = router;
