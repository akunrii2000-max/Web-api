'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function scrapeJagoKata(query) {
  try {
    const response = await axios.post(
      "https://jagokata.com/kata-bijak/cari.html",
      new URLSearchParams({
        citaat: query,
        zoekbutton: "Zoeken",
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 30000,
      }
    );

    const $ = cheerio.load(response.data);
    const quotes = [];

    $(
      "#main #content #content-container #images-container ul li, #main #content #content-container #citatenrijen li"
    )
      .each((_, el) => {
        const quote = $(el).find(".quotebody .fbquote").text().trim();
        const link = `https://jagokata.com${$(el).find("a").attr("href")}`;
        const img = $(el).find(".quotebody img").attr("data-src");
        const author = $(el)
          .find(".citatenlijst-auteur > a, .auteurfbnaam")
          .text()
          .trim();
        const description = $(el)
          .find(".citatenlijst-auteur > .auteur-beschrijving")
          .text()
          .trim();
        const lifespan = $(el)
          .find(".citatenlijst-auteur > .auteur-gebsterf")
          .text()
          .trim();
        const votes = $(el).find(".votes-content > .votes-positive").text().trim();
        const category = $("#main").find("h1.kamus").text().trim();
        const tags = $(el).attr("id");

        if (quote || author) {
          quotes.push({
            quote,
            link,
            img,
            author,
            description,
            lifespan,
            votes,
            category,
            tags,
          });
        }
      });

    if (quotes.length === 0) {
      throw new ValidationError(`No quotes found for "${query}"`, 404);
    }

    return quotes;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || "Failed to scrape JagoKata", 500);
  }
}

router.get("/api/fun/jagokata", asyncHandler(async (req, res) => {
  const { q, query, search } = req.query;
  const searchQuery = q || query || search;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  if (searchQuery.length > 100) {
    throw new ValidationError("Query must be less than 100 characters", 400);
  }

  const result = await scrapeJagoKata(searchQuery.trim());

  sendSuccessResponse(res, {
    search_query: searchQuery,
    total_results: result.length,
    quotes: result
  });
}));

router.post("/api/fun/jagokata", asyncHandler(async (req, res) => {
  const { q, query, search } = req.body;
  const searchQuery = q || query || search;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  if (searchQuery.length > 100) {
    throw new ValidationError("Query must be less than 100 characters", 400);
  }

  const result = await scrapeJagoKata(searchQuery.trim());

  sendSuccessResponse(res, {
    search_query: searchQuery,
    total_results: result.length,
    quotes: result
  });
}));

router.metadata = {
  name: "JagoKata Quotes Search",
  path: "/api/fun/jagokata",
  methods: ['GET', 'POST'],
  category: "FUN",
  description: "Search for inspirational and motivational quotes from JagoKata.com. Returns quotes with author information, descriptions, lifespans, votes, and category details.",
  params: [
    {
      name: "q",
      type: "text",
      required: true,
      placeholder: "kesuksesan",
      description: "Search query for quotes (also accepts: query, search)",
    },
  ],
};

module.exports = router;