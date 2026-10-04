'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError } = require('../../../utils/validation');
const { sendSuccessResponse }           = require('../../../config/apikeyConfig');

const router  = Router();
const BASE    = 'https://dramabox.dramabos.my.id';
const HEADERS = {
  'accept'          : '*/*',
  'accept-language' : 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'origin'          : BASE,
  'referer'         : BASE + '/',
  'sec-ch-ua'       : '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
  'sec-ch-ua-mobile': '?1',
  'sec-fetch-dest'  : 'empty',
  'sec-fetch-mode'  : 'cors',
  'sec-fetch-site'  : 'same-origin',
  'user-agent'      : 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36',
};

async function handle({ query, q, lang }, res) {
  const kw = query || q;
  if (!kw) throw new ValidationError('Parameter "query" wajib diisi.');
  const { data } = await axios.get(`${BASE}/api/v1/search`, {
    headers: HEADERS,
    params : { query: kw.trim(), lang: lang || 'in' },
  });
  sendSuccessResponse(res, data);
}

router.get('/api/search/dramasearch',  asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/search/dramasearch', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = {
  name       : 'DramaSearch',
  path       : '/api/search/dramasearch',
  methods    : ['GET', 'POST'],
  category   : 'SEARCH',
  description: 'Cari drama/series DramaBox.',
  params     : [
    { name: 'query', type: 'string', required: true,  description: 'Judul drama yang dicari' },
    { name: 'lang',  type: 'string', required: false, description: 'Bahasa hasil (default: in)' },
  ],
};

module.exports = router;
