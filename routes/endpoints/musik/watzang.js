'use strict';

const { Router } = require('express');
const axios      = require('axios');
const cheerio    = require('cheerio');
const { asyncHandler, ValidationError } = require('../../../utils/validation');
const { sendSuccessResponse }           = require('../../../config/apikeyConfig');

const router  = Router();
const BASE    = 'https://www.watzatsong.com';
const HEADERS = {
  'accept'         : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'user-agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
};

const VALID_GENRES = ['other','pop','rock','classical','electronic','hip-hop','r-b','country','jazz','metal'];

async function getGenrePage(genre = 'other', page = 1) {
  let url = `${BASE}/en/${genre}`;
  if (page > 1) url += `/last/${page}`;
  const { data } = await axios.get(url, { headers: HEADERS });
  const $ = cheerio.load(data);
  const samples = [];
  $('.sample-box').each((i, el) => {
    const $el = $(el);
    const id  = $el.find('.sample-box-actions-play').attr('sample_id') ||
                $el.find('a[href*="/name-that-tune/"]').attr('href')?.split('/').pop()?.replace('.html', '') || '';
    samples.push({
      id,
      title      : $el.find('.sample-box-comment a').attr('title') || '',
      url        : id ? `${BASE}/en/name-that-tune/${id}.html` : '',
      user       : $el.find('.sample-box-by-line .user').text() || '',
      genre      : $el.find('.sample-box-genre').text().trim(),
      audio_url  : $el.find('.sample-box-actions-play').attr('sample') || '',
      listen_count: parseInt($el.find('.sample-box-actions__counter').first().text().replace(/[()]/g, '')) || 0,
      comments   : parseInt($el.find('.sample-box-actions-comments').text()) || 0,
      is_premium : $el.hasClass('sample-box--premium'),
      posted_ago : $el.find('.sample-box__posted-ago').text().trim(),
    });
  });
  return { genre, page, total: samples.length, samples };
}

async function handle({ genre, page }, res) {
  const g = (genre || 'other').toLowerCase();
  const p = parseInt(page || '1') || 1;
  if (!VALID_GENRES.includes(g)) throw new ValidationError(`Genre tidak valid. Pilih salah satu: ${VALID_GENRES.join(', ')}`);
  const result = await getGenrePage(g, p);
  sendSuccessResponse(res, result);
}

router.get('/api/musik/watzang',  asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/musik/watzang', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = {
  name       : 'WatZatSong',
  path       : '/api/musik/watzang',
  methods    : ['GET', 'POST'],
  category   : 'MUSIK',
  description: 'Ambil daftar sampel musik dari WatZatSong berdasarkan genre.',
  params     : [
    { name: 'genre', type: 'string', required: false, description: 'Genre musik (other, pop, rock, classical, dll). Default: other' },
    { name: 'page',  type: 'number', required: false, description: 'Halaman (default: 1)' },
  ],
};

module.exports = router;
