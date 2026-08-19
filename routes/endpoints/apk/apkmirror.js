'use strict';

const { Router } = require('express');
const axios      = require('axios');
const cheerio    = require('cheerio');
const { asyncHandler, ValidationError } = require('../../../utils/validation');
const { sendSuccessResponse }           = require('../../../config/apikeyConfig');

const router  = Router();
const BASE    = 'https://www.apkmirror.com';
const HEADERS = {
  'User-Agent'               : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Accept'                   : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language'          : 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Upgrade-Insecure-Requests': '1',
};

async function search(query) {
  const url = `${BASE}/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(query)}`;
  const { data } = await axios.get(url, { headers: HEADERS, timeout: 30000 });
  const $ = cheerio.load(data);
  const results = [];
  $('.appRow').each((i, el) => {
    const row     = $(el);
    const titleEl = row.find('h5.appRowTitle a.fontBlack');
    const title   = titleEl.text().trim();
    const href    = titleEl.attr('href');
    if (!title || !href) return;
    const detailUrl    = href.startsWith('http') ? href : BASE + href;
    const version      = row.find('.infoSlide-value').first().text().trim();
    const uploadDateRaw = row.find('.datetime_utc').attr('data-utcdate');
    const developerEl  = row.find('.byDeveloper');
    const developerUrl = developerEl.attr('href');
    const iconSrc      = row.find('img.ellipsisText').attr('src');
    results.push({
      title,
      detailUrl,
      version,
      uploadDate : uploadDateRaw ? new Date(uploadDateRaw).toISOString() : null,
      fileSize   : row.find('.infoSlide-value').eq(1).text().trim(),
      downloads  : parseInt((row.find('.infoSlide-value').eq(2).text().trim() || '0').replace(/,/g, ''), 10) || null,
      developer  : developerEl.text().replace('by', '').trim(),
      developerUrl: developerUrl ? (developerUrl.startsWith('http') ? developerUrl : BASE + developerUrl) : null,
      iconUrl    : iconSrc ? (iconSrc.startsWith('http') ? iconSrc : BASE + iconSrc) : null,
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

router.get('/api/apk/apkmirror',  asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/apk/apkmirror', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = {
  name       : 'APKMirror Search',
  path       : '/api/apk/apkmirror',
  methods    : ['GET', 'POST'],
  category   : 'APK',
  description: 'Cari APK di APKMirror berdasarkan nama aplikasi.',
  params     : [{ name: 'query', type: 'string', required: true, description: 'Nama aplikasi yang dicari' }],
};

module.exports = router;
