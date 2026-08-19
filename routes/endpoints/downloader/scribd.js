'use strict';

const { Router } = require('express');
const axios      = require('axios');
const cheerio    = require('cheerio');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse }                     = require('../../../config/apikeyConfig');

const router = Router();
const BASE_HEADERS = {
  'Accept'          : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language' : 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'User-Agent'      : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0',
  'Upgrade-Insecure-Requests': '1',
};

let cookieString = '';

function makeClient() {
  const client = axios.create({ timeout: 15000, maxRedirects: 5, headers: BASE_HEADERS });
  client.interceptors.response.use((res) => {
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      setCookie.forEach(cookie => {
        const [k, v] = cookie.split(';')[0].split('=');
        if (!cookieString.includes(`${k}=`)) cookieString += (cookieString ? '; ' : '') + `${k}=${v || ''}`;
      });
      client.defaults.headers.common['Cookie'] = cookieString;
    }
    return res;
  });
  return client;
}

async function searchScribd(query) {
  const client   = makeClient();
  const { data } = await client.get(`https://id.scribd.com/search?query=${encodeURIComponent(query)}`);
  const $        = cheerio.load(data);
  const results  = [];
  $('[data-testid="search-results"] [class*="DocumentCell"], [data-e2e="search-results"] [class*="ScribdDocumentCell"]').each((i, el) => {
    const linkEl  = $(el).find('a[href*="/document/"]').first();
    const link    = linkEl.attr('href');
    const docId   = link?.match(/\/document\/(\d+)/)?.[1];
    const title   = $(el).find('[class*="title"]').first().text().trim();
    if (!title) return;
    results.push({
      title,
      author   : $(el).find('[class*="author"]').first().text().trim().replace(/^Oleh|^By/i, '').trim() || null,
      url      : link ? (link.startsWith('http') ? link : `https://id.scribd.com${link}`) : null,
      docId    : docId || null,
      thumbnail: $(el).find('img').first().attr('src') || null,
    });
  });
  return { query, total: results.length, results };
}

async function getScribdDoc(documentUrl) {
  const client   = makeClient();
  const { data } = await client.get(documentUrl);
  const $        = cheerio.load(data);
  const docId    = documentUrl.match(/\/document\/(\d+)/)?.[1];
  return {
    id         : docId,
    title      : $('meta[property="og:title"]').attr('content') || $('title').text().trim(),
    description: $('meta[property="og:description"]').attr('content') || null,
    url        : documentUrl,
    imageUrl   : $('meta[property="og:image"]').attr('content') || null,
    pageCount  : parseInt($('[data-e2e="metadata-page-count-wide"]').text().match(/\d+/)?.[0] || '0'),
    language   : $('html').attr('lang') || 'id',
  };
}

async function handle(params, res) {
  const { url, query, q } = params;
  if (url) {
    if (!validate.url(url)) throw new ValidationError('URL Scribd tidak valid.');
    const result = await getScribdDoc(url.trim());
    return sendSuccessResponse(res, result);
  }
  const kw = query || q;
  if (!kw) throw new ValidationError('Parameter "url" atau "query" wajib diisi.');
  const result = await searchScribd(kw.trim());
  sendSuccessResponse(res, result);
}

router.get('/api/downloader/scribd',  asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/downloader/scribd', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = {
  name       : 'Scribd',
  path       : '/api/downloader/scribd',
  methods    : ['GET', 'POST'],
  category   : 'DOWNLOADER',
  description: 'Cari atau ambil info dokumen Scribd.',
  params     : [
    { name: 'url',   type: 'string', required: false, description: 'URL dokumen Scribd (untuk detail dokumen)' },
    { name: 'query', type: 'string', required: false, description: 'Kata kunci pencarian dokumen' },
  ],
};

module.exports = router;
