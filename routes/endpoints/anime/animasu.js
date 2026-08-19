'use strict';

const { Router } = require('express');
const axios      = require('axios');
const cheerio    = require('cheerio');
const { asyncHandler, ValidationError } = require('../../../utils/validation');
const { sendSuccessResponse }           = require('../../../config/apikeyConfig');

const router  = Router();
const BASE    = 'https://v1.animasu.app';
const HEADERS = {
  'User-Agent'     : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Accept'         : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
};

async function getDetail(detailUrl) {
  const { data } = await axios.get(detailUrl, { headers: HEADERS });
  const $ = cheerio.load(data);
  const downloadLinks = [];
  $('.soraddlx .soraurlx').each((i, el) => {
    const quality = $(el).find('strong').text().trim();
    const links = [];
    $(el).find('a').each((j, a) => links.push({ server: $(a).text().trim(), url: $(a).attr('href') }));
    if (quality && links.length) downloadLinks.push({ quality, links });
  });
  const genres = [];
  $('.infox .spe a[href*="/genre/"]').each((i, el) => genres.push($(el).text().trim()));
  return {
    title           : $('h1').first().text().trim(),
    alternativeTitle: $('.alter').text().trim(),
    description     : $('.desc p').text().trim(),
    genres,
    status          : $('.spe span:contains("Status:")').text().replace('Status:', '').trim(),
    type            : $('.spe span:contains("Jenis:")').text().replace('Jenis:', '').trim(),
    duration        : $('.spe span:contains("Durasi:")').text().replace('Durasi:', '').trim(),
    studio          : $('.spe a[href*="/studio/"]').text().trim(),
    released        : $('.spe span:contains("Rilis:")').text().replace('Rilis:', '').trim(),
    rating          : $('.rating strong').text().replace('Rating', '').trim(),
    trailer         : $('.tply iframe').attr('src') || null,
    downloadLinks,
  };
}

async function search(query) {
  const { data } = await axios.get(`${BASE}/?s=${encodeURIComponent(query)}`, { headers: HEADERS });
  const $ = cheerio.load(data);
  const results = [];
  for (const el of $('.listupd .bs').toArray()) {
    const link     = $(el).find('a');
    const detailUrl = link.attr('href');
    const detail   = await getDetail(detailUrl);
    results.push({
      title    : link.attr('title') || link.find('.tt').text().trim(),
      detailUrl,
      thumbnail: $(el).find('.limit img').attr('src') || null,
      type     : $(el).find('.typez').text().trim(),
      episode  : $(el).find('.epx').text().trim(),
      detail,
    });
  }
  return results;
}

async function handle({ query, q }, res) {
  const kw = query || q;
  if (!kw) throw new ValidationError('Parameter "query" wajib diisi.');
  const results = await search(kw.trim());
  sendSuccessResponse(res, { query: kw, total: results.length, results });
}

router.get('/api/anime/animasu',  asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/anime/animasu', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = {
  name       : 'Animasu Search',
  path       : '/api/anime/animasu',
  methods    : ['GET', 'POST'],
  category   : 'ANIME',
  description: 'Cari anime di Animasu beserta detail dan link download.',
  params     : [{ name: 'query', type: 'string', required: true, description: 'Judul anime yang dicari' }],
};

module.exports = router;
