'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function searchQuotesAnime(query) {
  try {
    const { data } = await axios.get(
      `https://otakotaku.com/quote/search?q=${encodeURIComponent(query)}&q_filter=quote`,
      {
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      }
    );

    const $ = cheerio.load(data);
    const hasil = [];

    $("div.kotodama-list").each(function (l, h) {
      hasil.push({
        link: $(h).find("a").attr("href"),
        gambar: $(h).find("img").attr("data-src")?.replace("52x71", "157x213"),
        karakter: $(h).find("div.char-name").text().trim(),
        anime: $(h).find("div.anime-title").text().trim(),
        episode: $(h).find("div.meta").text(),
        up_at: $(h).find("small.meta").text(),
        quotes: $(h).find("div.quote").text().trim(),
      });
    });

    if (hasil.length === 0) {
      throw new ValidationError("No quotes found for this query", 404);
    }

    return hasil;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || "Failed to search anime quotes", 500);
  }
}

router.get("/api/search/quotesanime", asyncHandler(async (req, res) => {
  const { query, q, search } = req.query;
  const searchQuery = query || q || search;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await searchQuotesAnime(searchQuery.trim());

  sendSuccessResponse(res, {
    query: searchQuery,
    total: result.length,
    quotes: result
  });
}));

router.post("/api/search/quotesanime", asyncHandler(async (req, res) => {
  const { query, q, search } = req.body;
  const searchQuery = query || q || search;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await searchQuotesAnime(searchQuery.trim());

  sendSuccessResponse(res, {
    query: searchQuery,
    total: result.length,
    quotes: result
  });
}));

router.metadata = {
  name: "Anime Quotes Search",
  path: "/api/search/quotesanime",
  methods: ['GET', 'POST'],
  category: "SEARCH",
  description: "Search for anime quotes from Otakotaku. Returns quotes with character, anime title, episode, image, and upload time.",
  params: [
    {
      name: "query",
      type: "text",
      required: true,
      placeholder: "fate",
      description: "Search query for anime quotes (also accepts: q, search)",
    },
  ],
};

module.exports = router;