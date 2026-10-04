'use strict';

const { Router } = require('express');
const cheerio = require('cheerio');
const got = require('got');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function scrapeAntaraNews() {
  try {
    const response = await got("https://www.antaranews.com", {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9,id;q=0.8",
      },
      timeout: { request: 30000 },
      retry: {
        limit: 3,
        methods: ["GET"],
        statusCodes: [408, 413, 429, 500, 502, 503, 504],
        errorCodes: ["ETIMEDOUT", "ECONNRESET", "EADDRINUSE", "ECONNREFUSED", "EPIPE", "ENOTFOUND", "ENETUNREACH", "EAI_AGAIN"],
        calculateDelay: (retryObject) => Math.min(1000 * Math.pow(2, retryObject.attemptCount), 10000),
      },
    });

    const $ = cheerio.load(response.body);
    const results = [];

    $("#editor_picks .item").each((_, element) => {
      const $item = $(element);
      const title = $item.find(".post_title a").text().trim();
      const link = $item.find(".post_title a").attr("href");
      const image = $item.find("img").data("src");
      const category = $item.find(".list-inline .text-primary").text().trim();
      const isInfographic = $item.find(".format-overlay").length > 0;

      if (title && link) {
        results.push({
          title,
          link,
          image: image || null,
          category: category || null,
          type: isInfographic ? "infographic" : "article",
        });
      }
    });

    return results;
  } catch (error) {
    console.error("Error scraping Antara News:", error);
    throw new ValidationError(error.message || "Failed to scrape Antara News", 500);
  }
}

router.get("/api/news/antara", asyncHandler(async (req, res) => {
  const data = await scrapeAntaraNews();
  sendSuccessResponse(res, data);
}));

router.post("/api/news/antara", asyncHandler(async (req, res) => {
  const data = await scrapeAntaraNews();
  sendSuccessResponse(res, data);
}));

router.metadata = {
  name: "Antara News",
  path: "/api/news/antara",
  methods: ['GET', 'POST'],
  category: "NEWS",
  description: "Latest news from Antara News (Indonesian news agency)",
  params: [
  ],
};

module.exports = router;