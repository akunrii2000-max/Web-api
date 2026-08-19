'use strict';

const { Router: createRouter } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = createRouter();

async function scrapeRiddle() {
  try {
    const response = await axios.get(
      "https://raw.githubusercontent.com/BochilTeam/database/master/games/tebaktebakan.json",
      { timeout: 30000, headers: { "User-Agent": "Mozilla/5.0" } }
    );
    return response.data[Math.floor(Math.random() * response.data.length)];
  } catch (error) {
    throw new ValidationError("Failed to get riddle data", 500);
  }
}

router.get("/api/games/tebaktebakan", asyncHandler(async (req, res) => {
  const data = await scrapeRiddle();
  sendSuccessResponse(res, data);
}));

router.post("/api/games/tebaktebakan", asyncHandler(async (req, res) => {
  const data = await scrapeRiddle();
  sendSuccessResponse(res, data);
}));

router.metadata = [
  {
    name: "Tebak Tebakan (GET)",
    path: "/api/games/tebaktebakan",
    methods: ['GET'],
    category: "GAMES",
    description: "Get a random riddle guessing game.",
  },
  {
    name: "Tebak Tebakan (POST)",
    path: "/api/games/tebaktebakan",
    methods: ['POST'],
    category: "GAMES",
    description: "Get a random riddle guessing game via POST.",
  },
];

module.exports = router;