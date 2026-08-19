'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse, CHANNEL } = require('../../../config/apikeyConfig');

const router = Router();

async function scrapeTafsirMimpi(mimpi) {
  try {
    const response = await axios.get(
      "https://www.primbon.com/tafsir_mimpi.php",
      {
        params: {
          mimpi: mimpi,
          submit: "+Submit+",
        },
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        timeout: 10000,
      }
    );

    const $ = cheerio.load(response.data);
    const results = [];

    const content = $("#body").text();
    const mimpiRegex = new RegExp(`Mimpi.*?${mimpi}.*?(?=Mimpi|$)`, "gi");
    const matches = content.match(mimpiRegex);

    if (matches) {
      matches.forEach((match) => {
        const cleanText = match
          .trim()
          .replace(/\s+/g, " ")
          .replace(/\n/g, " ");

        const parts = cleanText.split("=");
        if (parts.length === 2) {
          results.push({
            mimpi: parts[0].trim().replace(/^Mimpi\s+/, ""),
            tafsir: parts[1].trim(),
          });
        }
      });
    }

    const solusiMatch = $("#body").text().match(/Solusi.*?Amien\.\./s);
    const solusi = solusiMatch ? solusiMatch[0].trim() : null;

    return {
      keyword: mimpi,
      hasil: results,
      total: results.length,
      solusi: solusi,
    };
  } catch (error) {
    console.error("API Error:", error.message);
    throw new ValidationError("Failed to get response from API", 500);
  }
}

router.get("/api/primbon/tafsir_mimpi", asyncHandler(async (req, res) => {
  const { mimpi } = req.query;

  if (!mimpi || typeof mimpi !== "string" || mimpi.trim().length === 0) {
    throw new ValidationError("Parameter 'mimpi' is required and must be a non-empty string", 400);
  }

  const result = await scrapeTafsirMimpi(mimpi.trim());

  res.json({
    success: true,
    creator: "dongtube",
    results: result,
    channel: CHANNEL
  });
}));

router.post("/api/primbon/tafsir_mimpi", asyncHandler(async (req, res) => {
  const { mimpi } = req.body;

  if (!mimpi || typeof mimpi !== "string" || mimpi.trim().length === 0) {
    throw new ValidationError("Parameter 'mimpi' is required and must be a non-empty string", 400);
  }

  const result = await scrapeTafsirMimpi(mimpi.trim());

  res.json({
    success: true,
    creator: "dongtube",
    results: result,
    channel: CHANNEL
  });
}));

router.metadata = {
  name: "Tafsir Mimpi",
  path: "/api/primbon/tafsir_mimpi",
  methods: ['GET', 'POST'],
  category: "PRIMBON",
  description: "Dream interpretations based on Primbon divination system. Returns interpretations and solutions.",
  params: [
    {
      name: "mimpi",
      type: "text",
      required: true,
      placeholder: "bertemu",
      description: "Dream keyword to interpret (e.g., 'bertemu' for meeting, 'ular' for snake)",
    },
  ],
};

module.exports = router;