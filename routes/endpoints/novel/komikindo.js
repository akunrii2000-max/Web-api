'use strict';

const { Router } = require('express');
const axios      = require('axios');
const cheerio    = require('cheerio');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse }                     = require('../../../config/apikeyConfig');

const router  = Router();
const BASE    = 'https://komikindo.ch';
const HEADERS = {
  'User-Agent'     : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Accept'         : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
};

async function searchKomik(query) {
  const { data } = await axios.get(BASE, { params: { s: query }, headers: HEADERS });
  const $       = cheerio.load(data);
  const results = [];
  $('.animposx').each((_, el) => {
    results.push({
      title    : $(el).find('h3').text().trim(),
      imageUrl : $(el).find('img').attr('src') || null,
      rating   : $(el).find('.rating').text().trim(),
      url      : $(el).find('.tt > h3 > a').attr('href') || null,
    });
  });
  return { query, total: results.length, results };
}

async function getDetail(url) {
  const { data } = await axios.get(url, { headers: HEADERS });
  const $        = cheerio.load(data);
  const title    = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
  const detailValues = [];
  $('.spe span').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    const parts = text.split(':');
    if (parts.length >= 2) detailValues.push(parts.slice(1).join(':').trim());
  });
  return {
    title,
    imageUrl          : $('.thumb img').attr('src') || null,
    rating            : $('.rating').text().trim().match(/\d+/)?.[0] || null,
    url,
    judulAlternatif   : detailValues[0] || null,
    status            : detailValues[1] || null,
    pengarang         : detailValues[2] || null,
    ilustrator        : detailValues[3] || null,
    tema              : detailValues[5] || null,
    jenisKomik        : detailValues[6] || null,
  };
}

async function handle(params, res) {
  const { url, query, q } = params;
  if (url) {
    if (!validate.url(url)) throw new ValidationError('URL tidak valid.');
    return sendSuccessResponse(res, await getDetail(url.trim()));
  }
  const kw = query || q;
  if (!kw) throw new ValidationError('Parameter "query" atau "url" wajib diisi.');
  sendSuccessResponse(res, await searchKomik(kw.trim()));
}

router.get('/api/novel/komikindo',  asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/novel/komikindo', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = {
  name       : 'KomikIndo',
  path       : '/api/novel/komikindo',
  methods    : ['GET', 'POST'],
  category   : 'NOVEL',
  description: 'Cari komik atau ambil detail komik dari KomikIndo.',
  params     : [
    { name: 'query', type: 'string', required: false, description: 'Judul komik yang dicari' },
    { name: 'url',   type: 'string', required: false, description: 'URL detail komik' },
  ],
};

module.exports = router;
