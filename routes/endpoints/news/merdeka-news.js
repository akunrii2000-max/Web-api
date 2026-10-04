'use strict';

const { Router } = require('express');
const cheerio = require('cheerio');
const got = require('got');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function scrapeMerdekaNews() {
  try {
    const response = await got("https://www.merdeka.com/peristiwa/", {
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

    $(".box-headline ul li.item").each((_, element) => {
      const $item = $(element);
      const title = $item.find(".item-title a").text().trim();
      let link = $item.find(".item-title a").attr("href");
      let image = $item.find(".item-img img").attr("src");
      const category = $item.find(".item-tag").text().trim();
      const date = $item.find(".item-date").text().trim();
      const description = $item.find(".item-description").text().trim();

      if (image && !image.startsWith("http")) {
        image = "https://www.merdeka.com" + image;
      }

      if (link && !link.startsWith("http")) {
        link = "https://www.merdeka.com" + link;
      }

      if (title && link) {
        results.push({
          title,
          link,
          image: image || null,
          category: category || null,
          date: date || null,
          description: description || null,
        });
      }
    });

    return results;
  } catch (error) {
    console.error("Error scraping Merdeka News:", error);
    throw new ValidationError(error.message || "Failed to scrape Merdeka News", 500);
  }
}

router.get("/api/news/merdeka", asyncHandler(async (req, res) => {
  const data = await scrapeMerdekaNews();
  sendSuccessResponse(res, data);
}));

router.post("/api/news/merdeka", asyncHandler(async (req, res) => {
  const data = await scrapeMerdekaNews();
  sendSuccessResponse(res, data);
}));

router.metadata = {
  name: "Merdeka News",
  path: "/api/news/merdeka",
  methods: ['GET', 'POST'],
  category: "NEWS",
  description: "Latest news headlines from Merdeka.com (Indonesian news portal)",
  params: [
  ],
};

module.exports = router;