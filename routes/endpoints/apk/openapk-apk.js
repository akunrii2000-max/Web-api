'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function scrapeOpenAPK(search) {
  try {
    const searchUrl = `https://www.openapk.net/search/?q=${encodeURIComponent(search)}`;

    const response = await axios.get(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);
    const results = [];

    $("#search_results .content-list .list-item").each((index, element) => {
      const $item = $(element);

      const href = "https://www.openapk.net" + $item.attr("href");
      const title = $item.attr("title");
      const iconSrc = "https://www.openapk.net" + $item.find("img").attr("src");
      const iconAlt = $item.find("img").attr("alt");
      const name = $item.find(".name").text().trim();
      const descriptions = $item
        .find(".desc")
        .map((i, el) => $(el).text().trim())
        .get();

      const description = descriptions.find(desc => !desc.startsWith("★")) || "";
      const rating = descriptions.find(desc => desc.startsWith("★")) || "";

      results.push({
        href,
        title,
        icon: {
          src: iconSrc,
          alt: iconAlt,
        },
        name,
        description,
        rating,
      });
    });

    if (results.length === 0) {
      throw new ValidationError(`No applications found for "${search}"`, 404);
    }

    return results;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || "Failed to scrape OpenAPK", 500);
  }
}

router.get("/api/apk/openapk", asyncHandler(async (req, res) => {
  const { search, q, query } = req.query;
  const searchQuery = search || q || query;

  const validation = validate.fields({ search: searchQuery }, {
    search: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await scrapeOpenAPK(searchQuery.trim());

  sendSuccessResponse(res, {
    search_query: searchQuery,
    total_results: result.length,
    applications: result
  });
}));

router.post("/api/apk/openapk", asyncHandler(async (req, res) => {
  const { search, q, query } = req.body;
  const searchQuery = search || q || query;

  const validation = validate.fields({ search: searchQuery }, {
    search: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await scrapeOpenAPK(searchQuery.trim());

  sendSuccessResponse(res, {
    search_query: searchQuery,
    total_results: result.length,
    applications: result
  });
}));

router.metadata = {
  name: "OpenAPK Search",
  path: "/api/apk/openapk",
  methods: ['GET', 'POST'],
  category: "APK",
  description: "Search for Android applications on OpenAPK.net. Returns application details including title, icon, description, and rating information.",
  params: [
    {
      name: "search",
      type: "text",
      required: true,
      placeholder: "free fire",
      description: "Search query for applications (also accepts: q, query)",
    },
  ],
};

module.exports = router;