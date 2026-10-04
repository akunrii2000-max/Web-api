'use strict';

const { Router } = require('express');
const axios      = require('axios');
const FormData   = require('form-data');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse }                     = require('../../../config/apikeyConfig');

const router  = Router();
const API_URL = 'https://api.doreso.com';
const HEADERS = {
  'User-Agent'     : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Accept'         : '*/*',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Origin'         : 'https://aha-music.com',
  'Referer'        : 'https://aha-music.com/',
};

async function uploadAudio(audioUrl) {
  const res    = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 30000 });
  const buffer = Buffer.from(res.data);
  const ext    = (audioUrl.split('?')[0].split('.').pop() || 'mp3').toLowerCase();
  const formData = new FormData();
  formData.append('file', buffer, { filename: `audio.${ext}` });
  const { data } = await axios.post(`${API_URL}/upload`, formData, {
    headers: { ...HEADERS, ...formData.getHeaders() },
  });
  return data?.data?.id;
}

async function getResult(uploadId) {
  const { data } = await axios.get(`${API_URL}/file/${uploadId}`, { headers: HEADERS });
  const item     = data?.data?.[0];
  const results  = [];
  if (item?.results?.music) {
    item.results.music.forEach(m => {
      if (!m.result) return;
      const t = m.result;
      results.push({
        title      : t.title,
        score      : t.score,
        durationMs : t.duration_ms,
        genres     : (t.genres || []).map(g => g.name),
        artists    : (t.artists || []).map(a => a.name),
        album      : t.album?.name || null,
        releaseDate: t.release_date,
        externalIds: t.external_ids || {},
      });
    });
  }
  return { uploadId, state: item?.state, total: item?.total, results };
}

async function identify(audioUrl, maxAttempts = 15, interval = 3000) {
  const uploadId = await uploadAudio(audioUrl);
  if (!uploadId) throw new ValidationError('Gagal upload audio.');
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getResult(uploadId);
    if (result.state === 1 && result.results.length > 0) return result;
    await new Promise(r => setTimeout(r, interval));
  }
  return await getResult(uploadId);
}

async function handle({ url, audio }, res) {
  const audioUrl = url || audio;
  if (!audioUrl || !validate.url(audioUrl)) throw new ValidationError('Parameter "url" audio wajib diisi dan valid.');
  const result = await identify(audioUrl.trim());
  sendSuccessResponse(res, { source_url: audioUrl, ...result });
}

router.get('/api/musik/whatmusic',  asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/musik/whatmusic', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = {
  name       : 'WhatMusic (Identify Song)',
  path       : '/api/musik/whatmusic',
  methods    : ['GET', 'POST'],
  category   : 'MUSIK',
  description: 'Identifikasi lagu dari file audio melalui URL.',
  params     : [{ name: 'url', type: 'string', required: true, description: 'URL file audio (mp3, wav, dll)' }],
};

module.exports = router;
