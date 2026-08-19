'use strict';

const { Router } = require('express');
const cheerio = require('cheerio');
const got = require('got');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();
const base_url = "https://www.tribunnews.com";

async function scrapeTribunNews() {
  try {
    const response = await got(base_url, {
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
    const result = [];
    const isi = $("li.art-list.pos_rel");

    isi.each((i, e) => {
      const title = $(e).children("div.mr140").children("h3").children("a").text().trim();
      const link = $(e).children("div.mr140").children("h3").children("a").attr("href");
      const image_thumbnail = $(e).children("div.fr").children("a").children("img").attr("src");
      const time = $(e).children("div.mr140").children(".grey").children("time").attr("title");

      if (title && link) {
        result.push({
          title,
          link,
          image_thumbnail: image_thumbnail || null,
          time: time || null,
        });
      }
    });

    return result;
  } catch (error) {
    console.error("Error scraping Tribunnews:", error);
    throw new ValidationError(error.message || "Failed to scrape Tribunnews", 500);
  }
}

router.get("/api/news/tribun", asyncHandler(async (req, res) => {
  const data = await scrapeTribunNews();
  sendSuccessResponse(res, data);
}));

router.post("/api/news/tribun", asyncHandler(async (req, res) => {
  const data = await scrapeTribunNews();
  sendSuccessResponse(res, data);
}));

router.metadata = {
  name: "Tribunnews News",
  path: "/api/news/tribun",
  methods: ['GET', 'POST'],
  category: "NEWS",
  description: "Latest news headlines from Tribunnews.com (Indonesian news portal)",
  params: [
  ],
};

module.exports = router;