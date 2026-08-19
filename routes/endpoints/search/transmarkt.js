'use strict';

const { Router } = require('express');
const axios      = require('axios');
const cheerio    = require('cheerio');
const { asyncHandler, ValidationError } = require('../../../utils/validation');
const { sendSuccessResponse }           = require('../../../config/apikeyConfig');

const router  = Router();
const BASE    = 'https://www.transfermarkt.co.id';
const HEADERS = {
  'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept'         : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
};

async function getPlayer(query) {
  const searchUrl  = `${BASE}/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(query)}`;
  const { data }   = await axios.get(searchUrl, { headers: HEADERS });
  const $          = cheerio.load(data);
  const firstRow   = $('#player-grid tbody tr').first();
  const detailHref = firstRow.find('.hauptlink a').first().attr('href');
  const id         = detailHref?.match(/spieler\/(\d+)/)?.[1];

  const searchResult = {
    name       : firstRow.find('.hauptlink a').first().text().trim(),
    position   : firstRow.find('td.zentriert').first().text().trim() || 'N/A',
    age        : firstRow.find('td.zentriert').eq(1).text().trim() || 'N/A',
    club       : firstRow.find('.tiny_wappen').first().attr('title') || 'N/A',
    nationality: firstRow.find('.flaggenrahmen').first().attr('title') || 'N/A',
    marketValue: firstRow.find('.rechts.hauptlink').first().text().trim() || 'N/A',
    image      : firstRow.find('.bilderrahmen-fixed').attr('src') || null,
    detailUrl  : detailHref ? (detailHref.startsWith('http') ? detailHref : BASE + detailHref) : null,
    id,
  };

  if (!id) return { query, search: searchResult, detail: null };

  const detailUrl  = `${BASE}/profil/spieler/${id}`;
  const { data: detailData } = await axios.get(detailUrl, { headers: HEADERS });
  const $$         = cheerio.load(detailData);

  const info = {};
  const infoItems = $$('.info-table .info-table__content').toArray();
  for (let i = 0; i < infoItems.length - 1; i += 2) {
    const label = $$(infoItems[i]).text().trim().replace(/\s+/g, ' ');
    const value = $$(infoItems[i+1]).text().trim().replace(/\s+/g, ' ');
    if (label) info[label] = value;
  }

  const stats = [];
  $$('.responsive-table table tbody tr').each((i, el) => {
    const cols = $$(el).find('td');
    if (cols.length < 4) return;
    const competition = $$(cols[0]).text().trim().replace(/\s+/g, ' ');
    if (!competition || competition.includes('Total')) return;
    stats.push({
      competition,
      apps   : $$(cols[1]).text().trim(),
      goals  : $$(cols[2]).text().trim(),
      assists: $$(cols[3]).text().trim(),
    });
  });

  const mvText = $$('.data-header__market-value-wrapper').first().text().trim().replace(/\s+/g, ' ');

  return {
    query,
    search: searchResult,
    detail: {
      id,
      name       : $$('h1').first().text().trim().replace(/\s+/g, ' '),
      image      : $$('.data-header__profile-image').attr('src') || null,
      club       : $$('.data-header__club a').first().text().trim() || 'N/A',
      fullName   : info['Nama lengkap:'] || 'N/A',
      age        : info['Tanggal lahir / Umur:'] || 'N/A',
      birthplace : info['Tempat kelahiran:']?.replace(/[^\w\s,]/g, '').trim() || 'N/A',
      height     : info['Tinggi:'] || 'N/A',
      nationality: info['Kewarganegaraan:']?.replace(/\s+/g, ' ').trim() || 'N/A',
      position   : info['Posisi:'] || 'N/A',
      marketValue: mvText.split('Update')[0].trim() || 'N/A',
      stats,
    },
  };
}

async function handle({ query, q }, res) {
  const kw = query || q;
  if (!kw) throw new ValidationError('Parameter "query" wajib diisi.');
  const result = await getPlayer(kw.trim());
  sendSuccessResponse(res, result);
}

router.get('/api/search/transmarkt',  asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/search/transmarkt', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = {
  name       : 'Transfermarkt Player',
  path       : '/api/search/transmarkt',
  methods    : ['GET', 'POST'],
  category   : 'SEARCH',
  description: 'Cari data pemain sepak bola di Transfermarkt (nilai pasar, statistik, profil).',
  params     : [{ name: 'query', type: 'string', required: true, description: 'Nama pemain sepak bola' }],
};

module.exports = router;
