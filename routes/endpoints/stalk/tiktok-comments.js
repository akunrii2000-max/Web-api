'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
const PAGE = 50;
const MAX_PAGES = 200;
const MAX_REPLY_PAGES = 50;
const MAX_REPLY_REQUESTS = 500;
const TIME_BUDGET_MS = 100000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

async function sget(url, { headers = {}, retries = 0, timeout = 25000 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await axios.get(url, {
        headers,
        timeout,
        maxRedirects: 5,
        validateStatus: () => true,
        responseType: 'text',
        transformResponse: [(d) => d],
      });
      if (res.status >= 500 && i < retries) {
        await sleep(500 * (i + 1));
        continue;
      }
      return {
        status: res.status,
        url: res.request?.res?.responseUrl || url,
        json: () => JSON.parse(res.data),
      };
    } catch (e) {
      lastErr = e;
      if (i < retries) await sleep(500 * (i + 1));
    }
  }
  throw lastErr;
}

function apiUrl(path, params) {
  const query = new URLSearchParams({
    aid: '1988',
    app_language: 'en',
    device_id: String(Math.floor(1e18 + Math.random() * 8e18)),
    browser_language: 'en-US',
    browser_platform: 'Win32',
    browser_name: 'Mozilla',
    browser_version: '5.0',
    screen_width: '1920',
    screen_height: '1080',
    webcast_language: 'en',
    channel: 'web',
    count: String(PAGE),
    ...params,
  });
  return `https://www.tiktok.com/api/comment/${path}/?${query}`;
}

async function fetchPage(url) {
  try {
    const r = await sget(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json', Referer: 'https://www.tiktok.com/' },
      retries: 2,
    });
    if (r.status !== 200) return { ok: false, msg: `HTTP ${r.status}` };
    const j = r.json();
    if (j.status_code !== 0) return { ok: false, msg: `status_code ${j.status_code}` };
    return {
      ok: true,
      comments: j.comments || [],
      hasMore: !!j.has_more,
      cursor: num(j.cursor),
      total: num(j.total),
    };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

async function resolveAwemeId(input) {
  const hit = (id, src) => ({ id, username: (String(src || '').match(/@([^/?#]+)/) || [])[1] || null });

  if (/^\d{6,}$/.test(input)) return hit(input);

  let url;
  try { url = new URL(input); } catch { return null; }
  if (!/^https?:$/.test(url.protocol) || !/(^|\.)tiktok\.com$/i.test(url.hostname)) return null;

  const direct = url.pathname.match(/\/(?:video|photo|embed\/v2)\/(\d{6,})/);
  if (direct) return hit(direct[1], url.pathname);

  try {
    const r = await sget(url.href, { headers: { 'User-Agent': UA }, retries: 1, timeout: 20000 });
    const m = r.url.match(/\/(?:video|photo)\/(\d{6,})/);
    if (m) return hit(m[1], r.url);
  } catch {}

  try {
    const r = await sget(`https://www.tiktok.com/oembed?url=${encodeURIComponent(input)}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      timeout: 20000,
    });
    if (r.status === 200) {
      const j = r.json();
      const id = /^\d{6,}$/.test(j.embed_product_id) ? j.embed_product_id : (String(j.html || '').match(/data-video-id="(\d{6,})"/) || [])[1];
      if (id) return hit(id, j.author_url);
    }
  } catch {}

  return null;
}

function normalize(c) {
  const u = c.user || {};
  const t = num(c.create_time);
  const images = (c.image_list || []).map((x) => x.url_list?.[0] || x.url).filter(Boolean);
  return {
    id: c.cid || null,
    author: u.nickname || '',
    username: u.unique_id || '',
    verified: !!(u.custom_verify || u.enterprise_verify_reason),
    text: c.text || '',
    likes: num(c.digg_count),
    replies_count: num(c.reply_comment_total),
    reply_to_id: c.reply_id && c.reply_id !== '0' ? c.reply_id : null,
    created_at: t > 0 ? new Date(t * 1000).toISOString() : null,
    language: c.comment_language || null,
    is_pinned: !!c.author_pin,
    avatar: u.avatar_thumb?.url_list?.[0] || null,
    images: images.length ? images : null,
    replies: [],
  };
}

async function scrapeComments(input, { withReplies, limit }) {
  const target = await resolveAwemeId(input);
  if (!target) throw new ValidationError('URL TikTok tidak valid. Gunakan URL video TikTok atau aweme_id.', 400);

  const awemeId = target.id;
  const deadline = Date.now() + TIME_BUDGET_MS;
  const comments = [];
  let total = 0;
  let timedOut = false;
  let error = null;

  for (let page = 0, cursor = 0; page < MAX_PAGES && comments.length < limit; page++) {
    if (Date.now() > deadline) { timedOut = true; break; }
    const p = await fetchPage(apiUrl('list', { aweme_id: awemeId, cursor }));
    if (!p.ok) { error = p.msg; break; }
    if (page === 0) total = p.total;
    for (const c of p.comments) {
      if (comments.length >= limit) break;
      comments.push(normalize(c));
    }
    if (!p.hasMore || !p.comments.length) break;
    cursor = p.cursor;
    await sleep(250);
  }

  if (!comments.length) {
    throw error
      ? new ValidationError(`Gagal mengambil komentar (${error}).`, 502)
      : new ValidationError('Tidak ada komentar ditemukan.', 404);
  }

  if (withReplies) {
    let requests = 0;
    outer: for (const c of comments) {
      if (!c.replies_count) continue;
      for (let page = 0, cursor = 0; page < MAX_REPLY_PAGES; page++) {
        if (requests >= MAX_REPLY_REQUESTS) break outer;
        if (Date.now() > deadline) { timedOut = true; break outer; }
        const p = await fetchPage(apiUrl('list/reply', { item_id: awemeId, comment_id: c.id, cursor }));
        requests++;
        if (!p.ok) break;
        for (const raw of p.comments) c.replies.push({ ...normalize(raw), parent_id: c.id });
        if (!p.hasMore || !p.comments.length) break;
        cursor = p.cursor;
        await sleep(250);
      }
    }
  }

  const totalReplies = comments.reduce((n, c) => n + c.replies.length, 0);
  const reachedLimit = Number.isFinite(limit) && comments.length >= limit;

  return {
    post: target.username ? `https://www.tiktok.com/@${target.username}/video/${awemeId}` : null,
    aweme_id: awemeId,
    total_comments: total,
    total_replies: totalReplies,
    count: comments.length,
    complete: !timedOut && (total === 0 || comments.length + totalReplies >= total || reachedLimit),
    comments,
  };
}

async function handle(req, res) {
  const src = req.method === 'POST' ? { ...req.query, ...req.body } : req.query;
  const input = String(src.url || src.link || src.id || '').trim();

  const v = validate.fields({ url: input }, { url: { required: true, type: 'string' } });
  if (!v.valid) throw new ValidationError('Parameter url wajib diisi.', 400);

  const rawLimit = parseInt(src.limit, 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 10000) : Infinity;

  sendSuccessResponse(res, await scrapeComments(input, {
    withReplies: String(src.replies ?? '1') !== '0',
    limit,
  }));
}

router.get('/api/stalk/tiktok-comments', asyncHandler(handle));
router.post('/api/stalk/tiktok-comments', asyncHandler(handle));

router.metadata = {
  name: 'TikTok Comments',
  path: '/api/stalk/tiktok-comments',
  methods: ['GET', 'POST'],
  category: 'STALK',
  description: 'Ambil semua komentar utama dan balasan dari video TikTok.',
  params: [
    {
      name: 'url',
      type: 'text',
      required: true,
      placeholder: 'https://vt.tiktok.com/ZSbsHGSQ2/',
      description: 'URL video TikTok atau aweme_id.',
    },
    {
      name: 'replies',
      type: 'text',
      required: false,
      placeholder: '1',
      description: '1 = sertakan balasan (default), 0 = hanya komentar utama.',
    },
    {
      name: 'limit',
      type: 'number',
      required: false,
      placeholder: '100',
      description: 'Batas komentar utama (maks 10000, default tanpa batas).',
    },
  ],
};

module.exports = router;
