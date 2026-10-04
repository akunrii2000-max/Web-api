'use strict';

const { Router: createRouter } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = createRouter();

async function scrapeFFCharacter() {
  try {
    const response = await axios.get(
      "https://raw.githubusercontent.com/siputzx/karakter-freefire/refs/heads/main/data.json",
      { timeout: 30000, headers: { "User-Agent": "Mozilla/5.0" } }
    );
    return response.data[Math.floor(Math.random() * response.data.length)];
  } catch (error) {
    throw new ValidationError("Failed to get Free Fire character data", 500);
  }
}

router.get("/api/games/karakter-freefire", asyncHandler(async (req, res) => {
  const data = await scrapeFFCharacter();
  sendSuccessResponse(res, data);
}));

router.post("/api/games/karakter-freefire", asyncHandler(async (req, res) => {
  const data = await scrapeFFCharacter();
  sendSuccessResponse(res, data);
}));

router.metadata = [
  {
    name: "Tebak Karakter Free Fire (GET)",
    path: "/api/games/karakter-freefire",
    methods: ['GET'],
    category: "GAMES",
    description: "Get a random Free Fire character for guessing game.",
  },
  {
    name: "Tebak Karakter Free Fire (POST)",
    path: "/api/games/karakter-freefire",
    methods: ['POST'],
    category: "GAMES",
    description: "Get a random Free Fire character via POST.",
  },
];

module.exports = router;