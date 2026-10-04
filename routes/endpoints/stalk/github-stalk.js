'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

const GH_API = 'https://api.github.com';
const UA     = 'Mozilla/5.0 (compatible; MikuAI-Bot/1.0)';

async function stalkGithub(username) {
  const clean = username.replace(/^@/, '').trim();
  if (!clean) throw new ValidationError('Username tidak boleh kosong.', 400);

  // Fetch user + repos + events secara paralel
  let user, repos, events;
  try {
    [{ data: user }, { data: repos }, { data: events }] = await Promise.all([
      axios.get(`${GH_API}/users/${clean}`,        { headers: { 'User-Agent': UA, 'Accept': 'application/vnd.github.v3+json' }, timeout: 12000 }),
      axios.get(`${GH_API}/users/${clean}/repos`,  { headers: { 'User-Agent': UA, 'Accept': 'application/vnd.github.v3+json' }, params: { sort: 'updated', per_page: 6 }, timeout: 12000 }),
      axios.get(`${GH_API}/users/${clean}/events`, { headers: { 'User-Agent': UA, 'Accept': 'application/vnd.github.v3+json' }, params: { per_page: 10 }, timeout: 12000 }),
    ]);
  } catch (err) {
    if (err.response?.status === 404) throw new ValidationError(`User "${clean}" tidak ditemukan di GitHub.`, 404);
    if (err.response?.status === 403) throw new ValidationError('GitHub API rate limit tercapai. Coba lagi nanti.', 429);
    throw new ValidationError(err.message || 'Gagal menghubungi GitHub API.', 500);
  }

  // Top repos (sort by stars)
  const topRepos = repos
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 6)
    .map(r => ({
      name:        r.name,
      description: r.description || '',
      language:    r.language || null,
      stars:       r.stargazers_count,
      forks:       r.forks_count,
      watchers:    r.watchers_count,
      url:         r.html_url,
      updated_at:  r.updated_at,
    }));

  // Hitung aktivitas dari events
  const pushCount  = events.filter(e => e.type === 'PushEvent').length;
  const prCount    = events.filter(e => e.type === 'PullRequestEvent').length;
  const issueCount = events.filter(e => e.type === 'IssuesEvent').length;

  // Total stars semua repo
  const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);
  const languages  = [...new Set(repos.map(r => r.language).filter(Boolean))];

  return {
    // Identitas
    username:      user.login,
    name:          user.name || '',
    user_id:       user.id,
    avatar:        user.avatar_url,
    bio:           user.bio || '',
    email:         user.email || null,
    blog:          user.blog || null,
    location:      user.location || null,
    company:       user.company || null,
    twitter:       user.twitter_username || null,
    hireable:      !!user.hireable,
    verified:      false, // GitHub tidak expose field ini di public API
    type:          user.type,      // User / Organization
    site_admin:    user.site_admin,
    profile_url:   user.html_url,
    created_at:    user.created_at,
    updated_at:    user.updated_at,

    // Statistik
    stats: {
      public_repos:   user.public_repos,
      public_gists:   user.public_gists,
      followers:      user.followers,
      following:      user.following,
      total_stars:    totalStars,
      languages_used: languages,
    },

    // Aktivitas (dari 10 event terakhir)
    recent_activity: {
      push_events:         pushCount,
      pull_request_events: prCount,
      issue_events:        issueCount,
    },

    // 6 repo terbaru/terpopuler
    top_repos: topRepos,
  };
}

// ── GET ──────────────────────────────────────────────────────────────────────
router.get('/api/stalk/github', asyncHandler(async (req, res) => {
  const username = req.query.username || req.query.user || req.query.q || '';

  const v = validate.fields({ username }, { username: { required: true, type: 'string' } });
  if (!v.valid) throw new ValidationError(v.errors.join(', '), 400);

  sendSuccessResponse(res, await stalkGithub(username));
}));

// ── POST ─────────────────────────────────────────────────────────────────────
router.post('/api/stalk/github', asyncHandler(async (req, res) => {
  const username = req.body.username || req.body.user || req.body.q || '';

  const v = validate.fields({ username }, { username: { required: true, type: 'string' } });
  if (!v.valid) throw new ValidationError(v.errors.join(', '), 400);

  sendSuccessResponse(res, await stalkGithub(username));
}));

// ── Metadata ─────────────────────────────────────────────────────────────────
router.metadata = {
  name:        'GitHub Stalk',
  path:        '/api/stalk/github',
  methods:     ['GET', 'POST'],
  category:    'STALK',
  description: 'Ambil informasi lengkap profil GitHub: bio, lokasi, statistik repo, followers, total stars, bahasa pemrograman yang digunakan, dan 6 repo terpopuler. Powered by GitHub Public API.',
  params: [
    {
      name:        'username',
      type:        'text',
      required:    true,
      placeholder: 'torvalds',
      description: 'Username GitHub target. Contoh: torvalds, octocat (dengan atau tanpa @)',
    },
  ],
};

module.exports = router;
