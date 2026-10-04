'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function searchDouyin(query) {
  try {
    const { data } = await axios.get('https://theresapis.vercel.app/search/douyin', {
      params: {
        q: query
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 30000
    });

    if (!data.status) {
      throw new ValidationError('Search failed', 500);
    }

    if (!data.result || !Array.isArray(data.result)) {
      throw new ValidationError('No results found', 404);
    }

    return {
      creator: data.creator,
      total_results: data.result.length,
      results: data.result
    };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    if (error.response) {
      throw new ValidationError(
        `Douyin API error: ${error.response.data?.message || error.response.statusText}`,
        error.response.status
      );
    }
    throw new ValidationError(error.message || 'Failed to search Douyin', 500);
  }
}

router.get("/api/search/douyin", asyncHandler(async (req, res) => {
  const { q, query, search, keyword } = req.query;
  const searchQuery = q || query || search || keyword;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await searchDouyin(searchQuery);

  sendSuccessResponse(res, {
    query: searchQuery,
    creator: result.creator,
    total_results: result.total_results,
    results: result.results
  });
}));

router.post("/api/search/douyin", asyncHandler(async (req, res) => {
  const { q, query, search, keyword } = req.body;
  const searchQuery = q || query || search || keyword;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await searchDouyin(searchQuery);

  sendSuccessResponse(res, {
    query: searchQuery,
    creator: result.creator,
    total_results: result.total_results,
    results: result.results
  });
}));

router.metadata = {
  name: "Douyin Search",
  path: "/api/search/douyin",
  methods: ['GET', 'POST'],
  category: "SEARCH",
  description: "Search videos on Douyin (TikTok China). Returns video information including title, author, likes, comments, and video URL. Powered by TheresAPIs.",
  params: [
    {
      name: "q",
      type: "text",
      required: true,
      placeholder: "cos",
      description: "Search query/keyword (also accepts: query, search, keyword)",
    },
  ],
};

module.exports = router;