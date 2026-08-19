'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function searchGSMArena(query) {
  try {
    const response = await axios.get(
      `https://gsmarena.com/results.php3?sQuickSearch=yes&sName=${encodeURIComponent(query)}`,
      {
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      }
    );

    const $ = cheerio.load(response.data);
    const result = [];
    const device = $(".makers").find("li");

    device.each((i, e) => {
      const img = $(e).find("img");
      const id = $(e).find("a").attr("href")?.replace(".php", "");
      const name = $(e).find("span").html()?.split("<br>").join(" ");
      const thumbnail = img.attr("src");
      const description = img.attr("title");

      if (id && name) {
        result.push({
          id,
          name,
          thumbnail: thumbnail ? `https://gsmarena.com/${thumbnail}` : null,
          description,
          url: `https://gsmarena.com/${id}.php`
        });
      }
    });

    if (result.length === 0) {
      throw new ValidationError("No mobile phones found", 404);
    }

    return result;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || "Failed to search GSMArena", 500);
  }
}

router.get("/api/search/gsmarena", asyncHandler(async (req, res) => {
  const { query, q, search } = req.query;
  const searchQuery = query || q || search;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await searchGSMArena(searchQuery.trim());

  sendSuccessResponse(res, {
    query: searchQuery,
    total: result.length,
    devices: result
  });
}));

router.post("/api/search/gsmarena", asyncHandler(async (req, res) => {
  const { query, q, search } = req.body;
  const searchQuery = query || q || search;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await searchGSMArena(searchQuery.trim());

  sendSuccessResponse(res, {
    query: searchQuery,
    total: result.length,
    devices: result
  });
}));

router.metadata = {
  name: "GSMArena Mobile Phone Search",
  path: "/api/search/gsmarena",
  methods: ['GET', 'POST'],
  category: "SEARCH",
  description: "Search for mobile phone information on GSMArena. Returns device name, thumbnail, description, and GSMArena page URL.",
  params: [
    {
      name: "query",
      type: "text",
      required: true,
      placeholder: "iphone",
      description: "Mobile phone search query (also accepts: q, search)",
    },
  ],
};

module.exports = router;