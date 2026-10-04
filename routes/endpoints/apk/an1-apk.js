'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function scrapeAN1(search) {
  try {
    const response = await axios.get(
      `https://an1.com/?story=${encodeURIComponent(search)}&do=search&subaction=search`,
      {
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      }
    );

    const $ = cheerio.load(response.data);
    const applications = [];

    $(".item").each((index, element) => {
      const $element = $(element);
      const app = {
        title: $element.find(".name a span").text().trim(),
        link: $element.find(".name a").attr("href"),
        developer: $element.find(".developer").text().trim(),
        image: $element.find(".img img").attr("src"),
        rating: {
          value: parseFloat($element.find(".current-rating").text()) || null,
          percentage: parseInt(
            $element
              .find(".current-rating", 10)
              .attr("style")
              ?.replace("width:", "")
              .replace("%;", "") || "0"
          ),
        },
        type: $element.find(".item_app").hasClass("mod") ? "MOD" : "Original",
      };
      applications.push(app);
    });

    if (applications.length === 0) {
      throw new ValidationError(`No applications found for "${search}"`, 404);
    }

    return applications;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || "Failed to scrape AN1", 500);
  }
}

router.get("/api/apk/an1", asyncHandler(async (req, res) => {
  const { search, q, query } = req.query;
  const searchQuery = search || q || query;

  const validation = validate.fields({ search: searchQuery }, {
    search: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await scrapeAN1(searchQuery.trim());

  sendSuccessResponse(res, {
    search_query: searchQuery,
    total_results: result.length,
    applications: result
  });
}));

router.post("/api/apk/an1", asyncHandler(async (req, res) => {
  const { search, q, query } = req.body;
  const searchQuery = search || q || query;

  const validation = validate.fields({ search: searchQuery }, {
    search: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await scrapeAN1(searchQuery.trim());

  sendSuccessResponse(res, {
    search_query: searchQuery,
    total_results: result.length,
    applications: result
  });
}));

router.metadata = {
  name: "AN1 APK Search",
  path: "/api/apk/an1",
  methods: ['GET', 'POST'],
  category: "APK",
  description: "Search for Android applications on AN1.com. Returns application details including title, link, developer, image, rating, and whether it's a MOD or Original version.",
  params: [
    {
      name: "search",
      type: "text",
      required: true,
      placeholder: "pou",
      description: "Search query for applications (also accepts: q, query)",
    },
  ],
};

module.exports = router;