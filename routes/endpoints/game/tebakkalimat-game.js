'use strict';

const { Router: createRouter } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = createRouter();

async function scrapeSentence() {
  try {
    const response = await axios.get(
      "https://raw.githubusercontent.com/BochilTeam/database/master/games/tebakkalimat.json",
      { timeout: 30000, headers: { "User-Agent": "Mozilla/5.0" } }
    );
    return response.data[Math.floor(Math.random() * response.data.length)];
  } catch (error) {
    throw new ValidationError("Failed to get sentence data", 500);
  }
}

router.get("/api/games/tebakkalimat", asyncHandler(async (req, res) => {
  const data = await scrapeSentence();
  sendSuccessResponse(res, data);
}));

router.post("/api/games/tebakkalimat", asyncHandler(async (req, res) => {
  const data = await scrapeSentence();
  sendSuccessResponse(res, data);
}));

router.metadata = [
  {
    name: "Tebak Kalimat (GET)",
    path: "/api/games/tebakkalimat",
    methods: ['GET'],
    category: "GAMES",
    description: "Get a random sentence guessing game.",
  },
  {
    name: "Tebak Kalimat (POST)",
    path: "/api/games/tebakkalimat",
    methods: ['POST'],
    category: "GAMES",
    description: "Get a random sentence guessing game via POST.",
  },
];
module.exports = router;