'use strict';

const { Router } = require('express');
const axios      = require('axios');
const cheerio    = require('cheerio');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse }                     = require('../../../config/apikeyConfig');

const router  = Router();
const BASE    = 'https://s9.nontonanimeid.boats';
const UAS     = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function getHeaders(referer = '') {
  return {
    'accept'                  : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language'         : 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'referer'                 : referer || BASE + '/',
    'upgrade-insecure-requests': '1',
    'user-agent'              : UAS[Math.floor(Math.random() * UAS.length)],
  };
}

function genCookies() {
  const ts = Date.now();
  return Object.entries({
    _lscache_vary          : Math.random().toString(36).substring(2, 34),
    _ga_S0L4FL6T3J         : `GS2.1.s${ts}`,
    _ga                    : `GA1.2.${Math.floor(Math.random() * 999999999)}.${ts}`,
    _gid                   : `GA1.2.${Math.floor(Math.random() * 999999999)}.${ts}`,
    _gat_gtag_UA_79646797_8: '1',
  }).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function search(query) {
  const { data } = await axios({ method: 'GET', url: BASE + '/', headers: { ...getHeaders(), cookie: genCookies() }, params: { s: query } });
  const $       = cheerio.load(data);
  const results = [];
  $('.as-anime-card').each((_, el) => {
    const $el = $(el);
    results.push({
      title   : $el.find('.as-anime-title').text().trim(),
      url     : $el.attr('href'),
      image   : $el.find('img').attr('src') || null,
      rating  : $el.find('.as-rating').text().replace('⭐', '').trim(),
      type    : $el.find('.as-type').text().replace('📺', '').trim(),
      season  : $el.find('.as-season').text().replace('📅', '').trim(),
      synopsis: $el.find('.as-synopsis').text().trim(),
      genres  : $el.find('.as-genre-tag').map((_, g) => $(g).text()).get(),
    });
  });
  return { query, total: results.length, results };
}

async function getDetail(url) {
  const { data } = await axios({ method: 'GET', url, headers: { ...getHeaders(BASE + '/'), cookie: genCookies() }, timeout: 15000 });
  const $        = cheerio.load(data);

  const genres = [];
  $('.anime-card__genres .genre-tag').each((_, el) => genres.push($(el).text().trim()));

  const episodesList = [];
  $('.episode-item').each((_, el) => {
    const $el = $(el);
    episodesList.push({ title: $el.find('.ep-title').text().trim(), url: $el.attr('href'), date: $el.find('.ep-date').text().trim() });
  });

  const recommendations = [];
  $('.related .as-anime-card').each((_, el) => {
    const $el = $(el);
    recommendations.push({
      title : $el.find('.as-anime-title').text().trim(),
      url   : $el.attr('href'),
      image : $el.find('img').attr('src') || null,
      rating: $el.find('.as-rating').text().replace('⭐', '').trim(),
      type  : $el.find('.as-type').text().replace('📺', '').trim(),
    });
  });

  return {
    title          : $('.entry-title').text().replace('Nonton', '').replace('Sub Indo', '').trim(),
    image          : $('.anime-card__sidebar img').attr('src') || null,
    trailer        : $('.trailerbutton').attr('href') || null,
    score          : $('.anime-card__score .value').text().trim(),
    type           : $('.anime-card__score .type').text().trim(),
    english        : $('li:contains("English:")').text().replace('English:', '').trim(),
    synonyms       : $('li:contains("Synonyms:")').text().replace('Synonyms:', '').trim(),
    studios        : $('li:contains("Studios:")').text().replace('Studios:', '').trim(),
    rating         : $('li:contains("Rating:")').text().replace('Rating:', '').trim(),
    popularity     : $('li:contains("Popularity:")').text().replace('Popularity:', '').trim(),
    aired          : $('li:contains("Aired:")').text().replace('Aired:', '').trim(),
    genres,
    status         : $('.info-item.status-finish').text().trim().replace('·', '').trim(),
    episodes       : $('.info-item:contains("Episodes")').text().trim().replace('·', '').trim(),
    duration       : $('.info-item:contains("min")').text().trim().replace('·', '').trim(),
    synopsis       : $('.synopsis-prose p').text().trim(),
    episodesList,
    recommendations,
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
  sendSuccessResponse(res, await search(kw.trim()));
}

router.get('/api/anime/nontonanime',  asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/anime/nontonanime', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = {
  name       : 'NontonAnime',
  path       : '/api/anime/nontonanime',
  methods    : ['GET', 'POST'],
  category   : 'ANIME',
  description: 'Cari anime atau ambil detail + episode dari NontonAnimeID.',
  params     : [
    { name: 'query', type: 'string', required: false, description: 'Judul anime yang dicari' },
    { name: 'url',   type: 'string', required: false, description: 'URL detail anime' },
  ],
};

module.exports = router;
