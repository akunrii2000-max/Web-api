'use strict';

const { Router } = require('express');
const axios      = require('axios');
const cheerio    = require('cheerio');
const { asyncHandler, ValidationError } = require('../../../utils/validation');
const { sendSuccessResponse }           = require('../../../config/apikeyConfig');

const router = Router();

async function getChipsetList() {
  const { data } = await axios.get('https://nanoreview.net/en/soc-list/rating', {
    headers: {
      'User-Agent'     : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
      'Accept'         : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    },
    timeout: 20000,
  });

  const $ = cheerio.load(data);
  const processors = [];

  $('table.table-list tbody tr').each((i, el) => {
    const tds        = $(el).find('td');
    const ratingText = $(tds[2]).text().trim().replace(/\s+/g, ' ');
    const ratingMatch = ratingText.match(/(\d+)\s+([A-D][+-]?)/);
    const coresText  = $(tds[5]).text().trim().replace(/\s+/g, '');
    const coresMatch = coresText.match(/(\d+)(\([^)]+\))?/);

    processors.push({
      rank        : $(tds[0]).text().trim(),
      name        : $(tds[1]).find('a').text().trim(),
      manufacturer: $(tds[1]).find('.text-gray-small').text().trim(),
      rating      : {
        score: ratingMatch ? parseInt(ratingMatch[1]) : null,
        grade: ratingMatch ? ratingMatch[2] : null,
      },
      antutu      : parseInt($(tds[3]).text().trim()) || null,
      geekbench   : {
        single: parseInt($(tds[4]).text().trim().split('/')[0]) || null,
        multi : parseInt($(tds[4]).text().trim().split('/')[1]) || null,
      },
      cores       : {
        total : coresMatch ? parseInt(coresMatch[1]) : null,
        config: coresMatch?.[2] || null,
      },
      clock: $(tds[6]).text().trim(),
      gpu  : $(tds[7]).text().trim(),
    });
  });

  return processors;
}

router.get('/api/search/nanoreview', asyncHandler(async (req, res) => {
  const list   = await getChipsetList();
  const { q, query, search } = req.query;
  const keyword = (q || query || search || '').toLowerCase().trim();
  const result  = keyword ? list.filter(p => p.name.toLowerCase().includes(keyword) || p.manufacturer.toLowerCase().includes(keyword)) : list;
  sendSuccessResponse(res, { total: result.length, data: result });
}));

router.post('/api/search/nanoreview', asyncHandler(async (req, res) => {
  const list    = await getChipsetList();
  const keyword = ((req.body.q || req.body.query || req.body.search) || '').toLowerCase().trim();
  const result  = keyword ? list.filter(p => p.name.toLowerCase().includes(keyword) || p.manufacturer.toLowerCase().includes(keyword)) : list;
  sendSuccessResponse(res, { total: result.length, data: result });
}));

router.metadata = {
  name       : 'NanoReview Chipset List',
  path       : '/api/search/nanoreview',
  methods    : ['GET', 'POST'],
  category   : 'SEARCH',
  description: 'Daftar & rating chipset smartphone dari NanoReview. Bisa difilter dengan query.',
  params     : [{ name: 'query', type: 'string', required: false, description: 'Filter nama chipset atau produsen (opsional)' }],
};

module.exports = router;
