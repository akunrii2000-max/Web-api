'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError } = require('../../../utils/validation');
const { sendSuccessResponse }           = require('../../../config/apikeyConfig');

const router   = Router();
const API_URL  = 'https://goapis.net';
const HEADERS  = {
  'User-Agent'     : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Accept'         : 'application/json, text/plain, */*',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer'        : 'https://onlymp3.org/en6/youtube-to-mp3',
  'Origin'         : 'https://onlymp3.org',
};

function extractVideoId(input) {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = input.match(regex);
  return match ? match[1] : input;
}

async function getMP3(urlOrId) {
  const videoId = extractVideoId(urlOrId);
  const { data } = await axios.get(`${API_URL}/api/v2/convert`, {
    params : { url: `https://www.youtube.com/watch?v=${videoId}`, format: 'mp3' },
    headers: HEADERS,
  });
  const downloadUrl = data?.url || data?.download_url || data?.downloadUrl || data?.link || data?.file;
  if (!downloadUrl) throw new ValidationError('Gagal mendapatkan link download MP3.');
  return { videoId, downloadUrl, youtubeUrl: `https://youtu.be/${videoId}` };
}

async function handle({ url, id, videoId }, res) {
  const input = url || id || videoId;
  if (!input) throw new ValidationError('Parameter "url" atau "id" YouTube wajib diisi.');
  const result = await getMP3(input.trim());
  sendSuccessResponse(res, result);
}

router.get('/api/musik/onlinemp3',  asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/musik/onlinemp3', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = {
  name       : 'YouTube to MP3 (OnlineMP3)',
  path       : '/api/musik/onlinemp3',
  methods    : ['GET', 'POST'],
  category   : 'MUSIK',
  description: 'Konversi video YouTube ke MP3 via OnlyMP3/GoAPIs.',
  params     : [{ name: 'url', type: 'string', required: true, description: 'URL atau ID video YouTube' }],
};

module.exports = router;
