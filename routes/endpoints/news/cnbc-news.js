'use strict';

const { Router } = require('express');
const cheerio = require('cheerio');
const got = require('got');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function scrapeCNBCIndonesiaNews() {
  try {
    const response = await got("https://www.cnbcindonesia.com/news", {
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

    $("article").each((_, element) => {
      const $article = $(element);
      const $link = $article.find("a");

      const link = $link.attr("href");
      const image = $link.find("img").attr("src");
      const category = $link.find("span.text-cnbc-support-orange").text().trim() || "";
      const title = $link.find("h2").text().trim();
      const label = $link.find("span.bg-cnbc-primary-blue").text().trim();
      const date = $link.find("span.text-gray").text().trim();

      const cleanCategory = category.replace("Video", "").trim();
      const cleanLabel = label.replace(/\s+/g, " ").trim();
      const cleanDate = date.replace(/\s+/g, " ").trim();

      if (title && link) {
        results.push({
          title,
          link,
          image: image || null,
          category: cleanCategory || null,
          label: cleanLabel || null,
          date: cleanDate || null,
          type: category.toLowerCase().includes("video") ? "video" : "article",
        });
      }
    });

    return results;
  } catch (error) {
    console.error("Error scraping CNBC Indonesia News:", error);
    throw new ValidationError(error.message || "Failed to scrape CNBC Indonesia News", 500);
  }
}

router.get("/api/news/cnbc", asyncHandler(async (req, res) => {
  const data = await scrapeCNBCIndonesiaNews();
  sendSuccessResponse(res, data);
}));

router.post("/api/news/cnbc", asyncHandler(async (req, res) => {
  const data = await scrapeCNBCIndonesiaNews();
  sendSuccessResponse(res, data);
}));

router.metadata = {
  name: "CNBC Indonesia News",
  path: "/api/news/cnbc",
  methods: ['GET', 'POST'],
  category: "NEWS",
  description: "Latest business and financial news from CNBC Indonesia",
  params: [
  ],
};

module.exports = router;