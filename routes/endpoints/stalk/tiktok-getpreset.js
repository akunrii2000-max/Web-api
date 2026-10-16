'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

const BASE = 'https://amfinder.web.id/api';
const MAX_TRY = 5;
const TIME_BUDGET_MS = 100000;

function parseSSE(text) {
  const events = [];
  let event = 'message';
  let data = [];
  const flush = () => {
    if (data.length) events.push({ event, data: data.join('\n') });
    event = 'message';
    data = [];
  };
  for (const line of String(text || '').split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trim());
    else if (!line.trim()) flush();
  }
  flush();
  return events;
}

async function fetchEvents(url, timeout, maxBytes) {
  try {
    const r = await axios.get(url, {
      timeout,
      responseType: 'text',
      maxContentLength: maxBytes,
      validateStatus: (s) => s >= 200 && s < 300,
    });
    return parseSSE(r.data);
  } catch (e) {
    const reason = e.response?.status ? `HTTP ${e.response.status}` : e.message;
    throw new ValidationError(`Gagal menghubungi sumber data (${reason}).`, 502);
  }
}

function parseJSON(text, message) {
  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError(message, 502);
  }
}

async function searchVideos(q, limit) {
  const events = await fetchEvents(`${BASE}/search?mode=pick&q=${encodeURIComponent(q)}`, 60000, 2 * 1024 * 1024);
  const candidates = events.find((e) => e.event === 'candidates');
  if (!candidates) throw new ValidationError('Respons kandidat sumber tidak valid.', 502);

  const payload = parseJSON(candidates.data, 'Respons kandidat sumber tidak valid.');
  const items = Array.isArray(payload.items) ? payload.items.slice(0, limit) : [];
  if (!items.length) throw new ValidationError(`Tidak ada video untuk "${q}".`, 404);

  const resultEvent = events.find((e) => e.event === 'result');
  let meta = {};
  if (resultEvent) {
    try { meta = JSON.parse(resultEvent.data); } catch {}
  }

  return {
    mode: 'search',
    query: q,
    total: meta.candidates ?? items.length,
    found: meta.foundCount ?? 0,
    elapsedMs: meta.elapsedMs ?? null,
    fromCache: meta.fromCache ?? null,
    result: items.map((x) => ({
      url: x.url || null,
      handle: x.handle || null,
      kind: x.kind || null,
      snippet: x.snippet ? String(x.snippet).slice(0, 180) : null,
      thumb: x.thumb || null,
      duration: x.duration ?? null,
      stats: x.stats || null,
    })),
  };
}

async function findPresets(url, timeout = 90000) {
  const events = await fetchEvents(`${BASE}/find?url=${encodeURIComponent(url)}`, timeout, 4 * 1024 * 1024);
  const resultEvent = events.find((e) => e.event === 'result');
  if (!resultEvent) throw new ValidationError('Respons sumber tidak valid.', 502);

  const data = parseJSON(resultEvent.data, 'Respons sumber tidak valid.');
  if (!data.ok) throw new ValidationError(data.error || 'Pencarian preset gagal.', 502);

  const presetLinks = (Array.isArray(data.presetLinks) ? data.presetLinks : []).map((x) => ({
    type: x.type || null,
    url: x.url || null,
    title: x.title || null,
    size: x.size || null,
    ratio: x.ratio || null,
    source: x.source || null,
    detail: x.detail || null,
    verified: !!x.verified,
    thumb: x.thumb || (Array.isArray(x.thumbs) ? x.thumbs[0] : null) || null,
  }));

  return {
    mode: 'url',
    found: !!data.found,
    creator: data.author || null,
    videoUrl: data.videoUrl || url,
    context: data.context || null,
    scanned: data.scanned || null,
    total: presetLinks.length,
    presetLinks,
    authorDetail: data.authorDetail || null,
    video: data.video
      ? {
          id: data.video.id || null,
          url: data.video.url || null,
          description: data.video.description ? String(data.video.description).slice(0, 500) : null,
          stats: data.video.stats || null,
          playUrlNoWm: data.video.playUrlNoWm || null,
        }
      : null,
    otherLinks: Array.isArray(data.otherLinks) ? data.otherLinks : [],
  };
}

async function autoSearch(q, limit) {
  const deadline = Date.now() + TIME_BUDGET_MS;
  const searched = await searchVideos(q, limit);
  const candidates = searched.result.filter((c) => c.url).slice(0, MAX_TRY);
  const timeout = Math.max(5000, Math.min(40000, deadline - Date.now()));
  const tasks = candidates.map((c) => findPresets(c.url, timeout).catch(() => null));
  let fallback = null;

  for (let i = 0; i < candidates.length; i++) {
    const found = await tasks[i];
    if (!found) continue;

    const out = {
      ...found,
      mode: 'auto-search',
      query: q,
      selectedUrl: candidates[i].url,
      selectedHandle: candidates[i].handle,
      totalCandidates: searched.total,
      tried: i + 1,
    };
    if (found.found && found.presetLinks.length) return out;
    if (!fallback) fallback = out;
  }

  return fallback || searched;
}

async function handle(req, res) {
  const src = req.method === 'POST' ? { ...req.query, ...req.body } : req.query;
  const input = String(src.q ?? src.url ?? src.query ?? '').trim();
  const limit = Math.min(Math.max(parseInt(src.limit, 10) || 10, 1), 30);

  if (!input) throw new ValidationError('Parameter q wajib diisi (link video atau kata kunci).', 400);

  if (/^https?:\/\//i.test(input)) return sendSuccessResponse(res, await findPresets(input));

  if (input.length < 2) throw new ValidationError('Kata kunci minimal 2 karakter.', 400);
  sendSuccessResponse(res, await autoSearch(input, limit));
}

router.get('/api/search/preset-am', asyncHandler(handle));
router.post('/api/search/preset-am', asyncHandler(handle));

router.metadata = {
  name: 'Preset Alight Motion',
  path: '/api/search/preset-am',
  methods: ['GET', 'POST'],
  category: 'STALK',
  description: 'Ekstrak link preset Alight Motion dari link video, atau cari lewat kata kunci.',
  params: [
    {
      name: 'q',
      type: 'text',
      required: true,
      placeholder: 'https://www.tiktok.com/@user/video/... atau kata kunci',
      description: 'Link video TikTok/YouTube atau kata kunci. Otomatis terdeteksi.',
    },
    {
      name: 'limit',
      type: 'number',
      required: false,
      placeholder: '10',
      description: 'Maksimal video hasil pencarian (1-30), hanya untuk kata kunci.',
    },
  ],
};

module.exports = router;
