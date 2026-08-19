'use strict';

const { Router } = require('express');
const axios      = require('axios');
const cheerio    = require('cheerio');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse }                     = require('../../../config/apikeyConfig');

const router  = Router();
const BASE    = 'https://klikxxi.me';
const HEADERS = {
  'User-Agent'    : 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36',
  'Accept'        : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'navigate',
};

function extractYear(title) {
  return title.match(/\b(19|20)\d{2}\b/)?.[0] || null;
}

function extractQuality(text) {
  for (const q of ['1080', '720', '480', '360', 'HD', 'HDTS', 'WEB-DL', 'BluRay']) {
    if (text.includes(q)) return q;
  }
  return null;
}

async function search(query) {
  const params = new URLSearchParams();
  params.append('s', query);
  params.append('post_type[]', 'post');
  params.append('post_type[]', 'tv');

  const { data } = await axios.get(`${BASE}/`, { params, headers: HEADERS });
  const $       = cheerio.load(data);
  const results = [];

  $('#gmr-main-load .item-infinite').each((_, el) => {
    const item       = $(el);
    const title      = item.find('.entry-title a').text().trim();
    const categories = [], countries = [];
    item.find('.gmr-movie-on a').each((_, a) => {
      const href = $(a).attr('href') || '';
      if (href.includes('/country/')) countries.push($(a).text().trim());
      else if (href.includes('/category/')) categories.push($(a).text().trim());
    });
    results.push({
      title,
      url      : item.find('.entry-title a').attr('href') || null,
      thumbnail: item.find('img').attr('data-lazy-src') || item.find('img').attr('src') || null,
      rating   : item.find('.gmr-rating-item').text().replace('icon_star', '').trim(),
      duration : item.find('.gmr-duration-item').text().trim(),
      quality  : item.find('.gmr-quality-item').text().trim(),
      categories,
      countries,
      trailerUrl: item.find('.gmr-trailer-popup').attr('href') || null,
      year     : extractYear(title),
    });
  });

  return { query, total: results.length, results };
}

async function getDetail(url) {
  const { data } = await axios.get(url, { headers: HEADERS });
  const $        = cheerio.load(data);

  const detail = {
    title        : $('.entry-title').text().trim(),
    thumbnail    : $('.gmr-movie-data figure img').attr('data-lazy-src') || $('.gmr-movie-data figure img').attr('src') || null,
    rating       : {
      value: $('.gmr-meta-rating span[itemprop="ratingValue"]').text().trim(),
      votes: $('.gmr-meta-rating span[itemprop="ratingCount"]').text().trim(),
    },
    description  : $('.entry-content p').first().text().trim(),
    metadata     : {},
    downloadLinks: [],
    relatedMovies: [],
    servers      : [],
  };

  $('.gmr-moviedata').each((_, el) => {
    const $el  = $(el);
    const label = $el.find('strong').text().replace(':', '').trim().toLowerCase();
    const cleanText = $el.clone().children().remove().end().text().trim();
    const map = {
      'genre'   : () => { detail.metadata.genres    = $el.find('a[rel="category tag"]').map((_, a) => $(a).text().trim()).get(); },
      'quality' : () => { detail.metadata.quality   = $el.find('a[rel="tag"]').text().trim(); },
      'year'    : () => { detail.metadata.year      = $el.find('a[rel="tag"]').text().trim(); },
      'country' : () => { detail.metadata.countries = $el.find('a[rel="tag"]').map((_, a) => $(a).text().trim()).get(); },
      'director': () => { detail.metadata.director  = $el.find('span[itemprop="name"] a').text().trim(); },
      'cast'    : () => { detail.metadata.cast      = $el.find('span[itemprop="name"] a').map((_, a) => $(a).text().trim()).get(); },
    };
    if (map[label]) map[label]();
    else if (cleanText) detail.metadata[label] = cleanText;
  });

  $('.gmr-download-list li').each((_, el) => {
    const link = $(el).find('a.button');
    if (!link.length) return;
    detail.downloadLinks.push({ title: link.text().trim(), url: link.attr('href'), quality: extractQuality(link.text()) });
  });

  $('.muvipro-player-tabs li a').each((_, el) => {
    detail.servers.push({ name: $(el).text().trim(), id: $(el).attr('id'), tabId: $(el).attr('href') });
  });

  const trailerBtn = $('a.gmr-trailer-popup[title*="Trailer"]');
  if (trailerBtn.length) detail.trailerUrl = trailerBtn.attr('href');

  detail.tags = $('.tags-links-content a[rel="tag"]').map((_, el) => $(el).text().trim()).get();

  return { url, detail };
}

async function handle(params, res) {
  const { url, query, q } = params;
  if (url) {
    if (!validate.url(url)) throw new ValidationError('URL tidak valid.');
    return sendSuccessResponse(res, await getDetail(url.trim()));
  }
  const kw = query || q;
  if (!kw) throw new ValidationError('Parameter "query" atau "url" wajib diisi.');
  sendSuccessResponse(res, await search(kw.trim()));
}

router.get('/api/search/klikxxi',  asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/search/klikxxi', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = {
  name       : 'KlikXXI',
  path       : '/api/search/klikxxi',
  methods    : ['GET', 'POST'],
  category   : 'SEARCH',
  description: 'Cari film/series atau ambil detail + link download dari KlikXXI.',
  params     : [
    { name: 'query', type: 'string', required: false, description: 'Judul film/series yang dicari' },
    { name: 'url',   type: 'string', required: false, description: 'URL halaman film untuk detail' },
  ],
};

module.exports = router;
