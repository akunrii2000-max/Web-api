'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function searchLyrics(title) {
  try {
    if (!validate.notEmpty(title)) {
      throw new ValidationError("Title is required", 400);
    }

    const { data } = await axios.get(
      `https://lrclib.net/api/search?q=${encodeURIComponent(title.trim())}`,
      {
        headers: {
          referer: `https://lrclib.net/search/${encodeURIComponent(title.trim())}`,
          "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 30000
      }
    );

    if (!data || data.length === 0) {
      throw new ValidationError("No lyrics found", 404);
    }

    return data.map(item => ({
      id: item.id,
      trackName: item.trackName,
      artistName: item.artistName,
      albumName: item.albumName,
      duration: item.duration,
      instrumental: item.instrumental,
      plainLyrics: item.plainLyrics,
      syncedLyrics: item.syncedLyrics
    }));
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    if (error.response?.status === 404) {
      throw new ValidationError("No lyrics found", 404);
    }
    throw new ValidationError(error.message || 'Failed to search lyrics', 500);
  }
}

router.get("/api/search/lyrics", asyncHandler(async (req, res) => {
  const { q, title } = req.query;
  const searchQuery = q || title;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await searchLyrics(searchQuery);

  sendSuccessResponse(res, {
    query: searchQuery,
    count: data.length,
    results: data
  });
}));

router.post("/api/search/lyrics", asyncHandler(async (req, res) => {
  const { q, title } = req.body;
  const searchQuery = q || title;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await searchLyrics(searchQuery);

  sendSuccessResponse(res, {
    query: searchQuery,
    count: data.length,
    results: data
  });
}));

router.metadata = {
  name: "Lyrics Search",
  path: "/api/search/lyrics",
  methods: ['GET', 'POST'],
  category: "SEARCH",
  description: "Search song lyrics with synchronized timestamps from LRCLib. Returns plain and synced lyrics with track info.",
  params: [
    {
      name: "q",
      type: "text",
      required: true,
      placeholder: "Shape of You Ed Sheeran",
      description: "Song title or artist name (also accepts: title)",
    },
  ],
};

module.exports = router;