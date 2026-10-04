'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError } = require('../../../utils/validation');
const { sendSuccessResponse }           = require('../../../config/apikeyConfig');

const router   = Router();
const BASE_URL = 'https://bonipedia.my.id';
const HEADERS  = {
  'Accept'         : '*/*',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Content-Type'   : 'application/json',
  'Origin'         : BASE_URL,
  'Referer'        : BASE_URL + '/',
  'User-Agent'     : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
};

async function cekApi(userId, zoneId, action, quick) {
  const { data } = await axios.post(`${BASE_URL}/cek_api.php`, { userId, zoneId, action, quick }, { headers: HEADERS });
  return data;
}

async function handle({ userId, zoneId, uid, zone, type }, res) {
  const id   = userId || uid;
  const zone_ = zoneId || zone;
  if (!id)    throw new ValidationError('Parameter "userId" wajib diisi.');
  if (!zone_) throw new ValidationError('Parameter "zoneId" wajib diisi.');

  const mode = (type || 'all').toLowerCase();
  let result;
  if (mode === 'nickname') {
    result = await cekApi(id, zone_, 'nickname', true);
  } else if (mode === 'bind') {
    result = await cekApi(id, zone_, 'cekbind', false);
  } else if (mode === 'profil') {
    result = await cekApi(id, zone_, 'search', false);
  } else {
    const [nickname, bind, profil] = await Promise.all([
      cekApi(id, zone_, 'nickname', true),
      cekApi(id, zone_, 'cekbind', false),
      cekApi(id, zone_, 'search',   false),
    ]);
    result = { userId: id, zoneId: zone_, nickname, bind, profil };
  }
  sendSuccessResponse(res, result);
}

router.get('/api/tools/mlbbstalk',  asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/tools/mlbbstalk', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = {
  name       : 'MLBB Stalk',
  path       : '/api/tools/mlbbstalk',
  methods    : ['GET', 'POST'],
  category   : 'TOOLS',
  description: 'Cek profil, nickname, dan bind akun Mobile Legends.',
  params     : [
    { name: 'userId', type: 'string', required: true,  description: 'ID user MLBB' },
    { name: 'zoneId', type: 'string', required: true,  description: 'Zone ID MLBB' },
    { name: 'type',   type: 'string', required: false, description: 'Tipe cek: all (default), nickname, bind, profil' },
  ],
};

module.exports = router;
