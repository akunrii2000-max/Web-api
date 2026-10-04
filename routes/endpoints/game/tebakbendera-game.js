'use strict';

const { Router: createRouter } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = createRouter();

async function scrapeFlag() {
  try {
    const response = await axios.get("https://flagcdn.com/en/codes.json", {
      timeout: 30000,
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const data = response.data;
    const randomKey = Object.keys(data)[Math.floor(Math.random() * Object.keys(data).length)];
    return {
      name: data[randomKey],
      img: `https://flagpedia.net/data/flags/ultra/${randomKey}.png`,
    };
  } catch (error) {
    throw new ValidationError("Failed to get flag data", 500);
  }
}

router.get("/api/games/tebakbendera", asyncHandler(async (req, res) => {
  const data = await scrapeFlag();
  sendSuccessResponse(res, data);
}));

router.post("/api/games/tebakbendera", asyncHandler(async (req, res) => {
  const data = await scrapeFlag();
  sendSuccessResponse(res, data);
}));

router.metadata = [
  {
    name: "Tebak Bendera (GET)",
    path: "/api/games/tebakbendera",
    methods: ['GET'],
    category: "GAMES",
    description: "Get a random flag guessing game.",
  },
  {
    name: "Tebak Bendera (POST)",
    path: "/api/games/tebakbendera",
    methods: ['POST'],
    category: "GAMES",
    description: "Get a random flag guessing game via POST.",
  },
];
module.exports = router;