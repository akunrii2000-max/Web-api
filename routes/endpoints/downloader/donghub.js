'use strict';

const { Router } = require('express');
const axios      = require('axios');
const cheerio    = require('cheerio');
const crypto     = require('crypto');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse }                     = require('../../../config/apikeyConfig');

const router = Router();
const BASE   = 'https://donghub.vip';

function genCookies() {
  const rand = (n) => crypto.randomBytes(Math.ceil(n/2)).toString('hex').slice(0, n);
  const ts   = Date.now();
  return `_ga=GA1.1.${rand(8)}.${rand(10)}; _ga_BC9Q6DVLH9=GS2.1.s${ts}$o1$g1$t${ts+1000}$j35$l0$h0`;
}

const HEADERS = {
  'User-Agent'               : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Accept'                   : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language'          : 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Upgrade-Insecure-Requests': '1',
  'Cookie'                   : genCookies(),
};

async function search(query) {
  const { data } = await axios.get(`${BASE}/?s=${encodeURIComponent(query)}`, { headers: HEADERS });
  const $ = cheerio.load(data);
  const results = [];
  $('.listupd article.bs').each((i, el) => {
    const article = $(el);
    const link    = article.find('a');
    results.push({
      title   : link.attr('title') || link.find('h2').text(),
      url     : link.attr('href'),
      image   : article.find('img').attr('src') || null,
      type    : article.find('.typez').text(),
      status  : article.find('.epx').text(),
      subtitle: article.find('.sb').text(),
      hot     : article.find('.hotbadge').length > 0,
    });
  });
  return { query, total: results.length, results };
}

async function handle({ query, q }, res) {
  const kw = query || q;
  if (!kw) throw new ValidationError('Parameter "query" wajib diisi.');
  const result = await search(kw.trim());
  sendSuccessResponse(res, result);
}

router.get('/api/downloader/donghub',  asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/downloader/donghub', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = {
  name       : 'Donghub Search',
  path       : '/api/downloader/donghub',
  methods    : ['GET', 'POST'],
  category   : 'DOWNLOADER',
  description: 'Cari drama/film di Donghub.',
  params     : [{ name: 'query', type: 'string', required: true, description: 'Judul yang dicari' }],
};

module.exports = router;
