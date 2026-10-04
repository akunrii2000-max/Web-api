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
  const ga1  = rand(8) + '.' + rand(10);
  const ga2  = `GS2.1.s${ts}$o1$g1$t${ts + 1000}$j35$l0$h0`;
  const pubcid = `${rand(8)}-${rand(4)}-${rand(4)}-${rand(4)}-${rand(12)}`;
  const panoramaId = rand(64);
  return `_ga=GA1.1.${ga1}; HstCfa5009307=${ts}3385; HstCla5009307=${ts}3385; HstCmu5009307=${ts}3385; HstPn5009307=1; HstPt5009307=1; HstCnv5009307=1; HstCns5009307=1; __dtsu=6D00${ts}67439490D2359A715FA14; _pubcid=${pubcid}; _cc_id=${rand(16)}cd685c2ab8ae6766; panoramaId_expiry=${ts + 86400000}; panoramaId=${panoramaId}; panoramaIdType=panoDevice; _ga_BC9Q6DVLH9=${ga2}`;
}

const HEADERS = {
  'User-Agent'               : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Accept'                   : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language'          : 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Ch-Ua'                : '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
  'Sec-Ch-Ua-Mobile'         : '?0',
  'Sec-Ch-Ua-Platform'       : '"Linux"',
  'Sec-Fetch-Dest'           : 'document',
  'Sec-Fetch-Mode'           : 'navigate',
  'Sec-Fetch-Site'           : 'same-origin',
  'Sec-Fetch-User'           : '?1',
  'Upgrade-Insecure-Requests': '1',
};

async function getEpisodeVideoUrl(episodeUrl, cookies) {
  const { data } = await axios.get(episodeUrl, { headers: { ...HEADERS, Cookie: cookies } });
  const $            = cheerio.load(data);
  const videoSources = [];

  $('iframe').each((i, el) => {
    const src = $(el).attr('src');
    if (!src) return;
    videoSources.push({ type: 'iframe', url: src, provider: src.includes('youtube') ? 'youtube' : src.includes('drive') ? 'gdrive' : 'embed' });
  });

  $('video source').each((i, el) => {
    const src = $(el).attr('src');
    if (!src) return;
    videoSources.push({ type: 'video', url: src, format: $(el).attr('type') || 'video/mp4' });
  });

  $('a[href*=".mp4"], a[href*=".mkv"], a[href*=".m3u8"]').each((i, el) => {
    videoSources.push({ type: 'direct', url: $(el).attr('href'), quality: $(el).text().match(/\d+p/)?.[0] || 'unknown' });
  });

  const playerScript = $('script:contains("player.src")').text();
  if (playerScript) {
    const matches = playerScript.match(/https?:\/\/[^\s"']+\.(?:mp4|mkv|m3u8)[^\s"']*/g);
    if (matches) matches.forEach(u => videoSources.push({ type: 'script', url: u, quality: 'unknown' }));
  }

  return videoSources;
}

async function search(query, cookies) {
  const { data } = await axios.get(`${BASE}/?s=${encodeURIComponent(query)}`, {
    headers: { ...HEADERS, Cookie: cookies, Referer: BASE + '/' },
  });
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

async function getDetail(url, cookies) {
  const { data } = await axios.get(url, { headers: { ...HEADERS, Cookie: cookies, Referer: BASE + '/' } });
  const $ = cheerio.load(data);

  const detail = {
    title      : $('.entry-title').first().text(),
    url,
    image      : $('.thumb img').attr('src') || $('.bigcover img').attr('src') || null,
    alternative: $('.alter').text(),
    status     : $('.spe span:contains("Status:")').text().replace('Status:', '').trim(),
    network    : $('.spe a[href*="network"]').text(),
    released   : $('.spe span:contains("Released:")').text().replace('Released:', '').trim(),
    duration   : $('.spe span:contains("Duration:")').text().replace('Duration:', '').trim(),
    country    : $('.spe a[href*="country"]').text(),
    type       : $('.spe span:contains("Type:")').text().replace('Type:', '').trim(),
    episodes   : $('.spe span:contains("Episodes:")').text().replace('Episodes:', '').trim(),
    updated    : $('.spe time[itemprop="dateModified"]').text() || $('.spe span:contains("Updated on:")').text().replace('Updated on:', '').trim(),
    genres     : [],
    synopsis   : $('.entry-content p').first().text().replace(/\n/g, ' ').trim(),
    episodeList: [],
  };

  $('.genxed a').each((i, el) => detail.genres.push($(el).text()));

  const episodePromises = [];
  $('.eplister ul li').each((i, el) => {
    const episodeUrl = $(el).find('a').attr('href');
    episodePromises.push(
      getEpisodeVideoUrl(episodeUrl, cookies).then(videoSources => ({
        episode    : $(el).find('.epl-num').text(),
        title      : $(el).find('.epl-title').text(),
        url        : episodeUrl,
        releaseDate: $(el).find('.epl-date').text(),
        subtitle   : $(el).find('.epl-sub .status').text(),
        videoSources,
      }))
    );
  });

  detail.episodeList = await Promise.all(episodePromises);
  return detail;
}

async function handle(params, res) {
  const cookies = genCookies();
  const { query, q, url } = params;

  if (url) {
    if (!validate.url(url)) throw new ValidationError('URL Donghub tidak valid.');
    const result = await getDetail(url.trim(), cookies);
    return sendSuccessResponse(res, result);
  }

  const kw = query || q;
  if (!kw) throw new ValidationError('Parameter "query" atau "url" wajib diisi.');
  const result = await search(kw.trim(), cookies);
  sendSuccessResponse(res, result);
}

router.get('/api/anime/donghub',  asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/anime/donghub', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = [
  {
    name       : 'Donghub Search',
    path       : '/api/anime/donghub',
    methods    : ['GET', 'POST'],
    category   : 'ANIME',
    description: 'Cari drama/anime di Donghub.',
    params     : [{ name: 'query', type: 'string', required: true, description: 'Judul yang dicari' }],
  },
  {
    name       : 'Donghub Detail',
    path       : '/api/anime/donghub',
    methods    : ['GET', 'POST'],
    category   : 'ANIME',
    description: 'Ambil detail drama/anime dari Donghub beserta list episode & video source.',
    params     : [{ name: 'url', type: 'string', required: true, description: 'URL detail halaman Donghub' }],
  },
];

module.exports = router;
