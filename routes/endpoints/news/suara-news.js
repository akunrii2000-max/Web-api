'use strict';

const { Router } = require('express');
const cheerio = require('cheerio');
const got = require('got');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function scrapeSuaraNews() {
  try {
    const response = await got("https://www.suara.com/news", {
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

    const headline = $(".headline-content");
    if (headline.length > 0) {
      const title = headline.find("h2 a").text().trim();
      const link = headline.find("h2 a").attr("href");
      const image = headline.find("img").attr("src");
      const category = headline.find(".kanal span").text().trim();
      const date = headline.find(".headline-date").text().trim();

      if (title && link) {
        results.push({
          title,
          link,
          image: image || null,
          category: category || null,
          date: date || null,
        });
      }
    }

    $(".list-item-x .item:not([style*=\"display:none\"])").each((_, element) => {
      const $item = $(element);
      const title = $item.find(".description h2 a").text().trim();
      const link = $item.find(".description h2 a").attr("href");
      const image = $item.find(".img-thumb-1 img").attr("src");
      const category = $item.find(".description span.c-default").text().trim();

      if (title && link) {
        results.push({
          title,
          link,
          image: image || null,
          category: category || null,
        });
      }
    });

    return results;
  } catch (error) {
    console.error("Error scraping Suara News:", error);
    throw new ValidationError(error.message || "Failed to scrape Suara News", 500);
  }
}

router.get("/api/news/suara", asyncHandler(async (req, res) => {
  const data = await scrapeSuaraNews();
  sendSuccessResponse(res, data);
}));

router.post("/api/news/suara", asyncHandler(async (req, res) => {
  const data = await scrapeSuaraNews();
  sendSuccessResponse(res, data);
}));

router.metadata = {
  name: "Suara News",
  path: "/api/news/suara",
  methods: ['GET', 'POST'],
  category: "NEWS",
  description: "Latest news headlines from Suara.com (Indonesian news portal)",
  params: [
  ],
};

module.exports = router;