'use strict';

const { Router } = require('express');
const cheerio = require('cheerio');
const got = require('got');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function scrapeKompasNews() {
  try {
    const response = await got("https://news.kompas.com", {
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

    $(".articleList.-list .articleItem").each((_, element) => {
      const $article = $(element);
      const title = $article.find(".articleTitle").text().trim();
      const link = $article.find(".article-link").attr("href");
      const image = $article.find(".articleItem-img img").data("src");
      const category = $article.find(".articlePost-subtitle").text().trim();
      const date = $article.find(".articlePost-date").text().trim();

      if (title && link) {
        results.push({
          title,
          link,
          image: image || null,
          category: category || null,
          date: date || null,
        });
      }
    });

    return results;
  } catch (error) {
    console.error("Error scraping Kompas News:", error);
    throw new ValidationError(error.message || "Failed to scrape Kompas News", 500);
  }
}

router.get("/api/news/kompas", asyncHandler(async (req, res) => {
  const data = await scrapeKompasNews();
  sendSuccessResponse(res, data);
}));

router.post("/api/news/kompas", asyncHandler(async (req, res) => {
  const data = await scrapeKompasNews();
  sendSuccessResponse(res, data);
}));

router.metadata = {
  name: "Kompas News",
  path: "/api/news/kompas",
  methods: ['GET', 'POST'],
  category: "NEWS",
  description: "Latest news headlines from Kompas.com (Indonesian news portal)",
  params: [
  ],
};

module.exports = router;