'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function scrapeLatestNews() {
  try {
    const response = await axios.get("https://www.sindonews.com/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    const $ = cheerio.load(response.data);
    const articles = [];

    $(".list-article").each((index, element) => {
      const title = $(element).find(".title-article").text().trim();
      const link = $(element).find("a").attr("href");
      const category = $(element).find(".sub-kanal").text().trim();
      const timestamp = $(element).find(".date-article").text().trim();
      const imageUrl = $(element).find("img.lazyload").attr("data-src");

      if (title && link) {
        articles.push({
          title,
          link,
          category: category || null,
          timestamp: timestamp || null,
          imageUrl: imageUrl || null,
        });
      }
    });

    return articles;
  } catch (error) {
    console.error("Error scraping Sindonews:", error);
    throw new ValidationError(error.message || "Failed to scrape Sindonews", 500);
  }
}

router.get("/api/news/sindonews", asyncHandler(async (req, res) => {
  const data = await scrapeLatestNews();
  sendSuccessResponse(res, data);
}));

router.post("/api/news/sindonews", asyncHandler(async (req, res) => {
  const data = await scrapeLatestNews();
  sendSuccessResponse(res, data);
}));

router.metadata = {
  name: "Sindonews News",
  path: "/api/news/sindonews",
  methods: ['GET', 'POST'],
  category: "NEWS",
  description: "Latest news headlines from Sindonews.com (Indonesian news portal)",
  params: [
  ],
};

module.exports = router;