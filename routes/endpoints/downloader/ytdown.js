'use strict';

const { Router }     = require('express');
const axios          = require('axios');
const FormData       = require('form-data');
const { randomUUID } = require('crypto');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse }                     = require('../../../config/apikeyConfig');

const router  = Router();
const BASE    = 'https://app.ytdown.to';

function makeSession() {
  return {
    PHPSESSID: randomUUID().replace(/-/g, ''),
    _ga       : `GA1.1.${Math.floor(Math.random() * 1e9)}.${Math.floor(Date.now() / 1000)}`,
  };
}

async function getVideoInfo(url) {
  const cookies = makeSession();
  const cookieStr = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  const headers = {
    'User-Agent'      : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    'Accept'          : '*/*',
    'Accept-Language' : 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Origin'          : BASE,
    'Referer'         : BASE + '/id15/',
    'x-requested-with': 'XMLHttpRequest',
    'Cookie'          : cookieStr,
  };
  const form = new FormData();
  form.append('url', url);
  const { data } = await axios.post(`${BASE}/proxy.php`, form, {
    headers: { ...headers, ...form.getHeaders() },
  });
  return data;
}

async function handle({ url }, res) {
  if (!url || !validate.url(url)) throw new ValidationError('Parameter "url" YouTube wajib diisi dan valid.');
  if (!url.includes('youtube.com') && !url.includes('youtu.be')) throw new ValidationError('URL harus merupakan link YouTube.');
  const result = await getVideoInfo(url.trim());
  sendSuccessResponse(res, result);
}

router.get('/api/downloader/ytdown',  asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/downloader/ytdown', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = {
  name       : 'YouTube Downloader (YTDown)',
  path       : '/api/downloader/ytdown',
  methods    : ['GET', 'POST'],
  category   : 'DOWNLOADER',
  description: 'Dapatkan info dan link download.',
  params     : [{ name: 'url', type: 'string', required: true, description: 'URL video YouTube' }],
};

module.exports = router;
