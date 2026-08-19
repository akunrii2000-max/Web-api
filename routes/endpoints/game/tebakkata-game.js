'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function scrapeWord() {
  try {
    const response = await axios.get(
      "https://raw.githubusercontent.com/BochilTeam/database/master/games/tebakkata.json",
      {
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );
    const src = response.data;
    return src[Math.floor(Math.random() * src.length)];
  } catch (error) {
    console.error("API Error:", error.message);
    throw new ValidationError("Error fetching data: " + error.message, 500);
  }
}

router.get("/api/games/tebakkata", asyncHandler(async (req, res) => {
  const data = await scrapeWord();

  if (!data) {
    throw new ValidationError("No result returned from API", 500);
  }

  sendSuccessResponse(res, data);
}));

router.post("/api/games/tebakkata", asyncHandler(async (req, res) => {
  const data = await scrapeWord();

  if (!data) {
    throw new ValidationError("No result returned from API", 500);
  }

  sendSuccessResponse(res, data);
}));

router.metadata = [
  {
    name: "Tebak Kata (GET)",
    path: "/api/games/tebakkata",
    methods: ['GET'],
    category: "GAMES",
    description: "Get a random word guessing game question from the Tebak Kata database.",
    params: [
    ],
  },
  {
    name: "Tebak Kata (POST)",
    path: "/api/games/tebakkata",
    methods: ['POST'],
    category: "GAMES",
    description: "Get a random word guessing game question via POST request.",
    params: [
    ],
  },
];

module.exports = router;