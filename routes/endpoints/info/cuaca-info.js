'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

class WeatherService {
  constructor() {
    this.baseUrl =
      "https://raw.githubusercontent.com/kodewilayah/permendagri-72-2019/main/dist/base.csv";
    this.bmkgUrl = "https://api.bmkg.go.id/publik/prakiraan-cuaca";
  }

  determineBMKGUrl(code) {
    const dots = (code.match(/\./g) || []).length;
    const admLevel = dots + 1;
    return `${this.bmkgUrl}?adm${admLevel}=${code}`;
  }

  parseWilayahCode(code) {
    const parts = code.split(".");
    const levels = {
      adm1: parts[0],
      adm2: parts.length >= 2 ? parts.slice(0, 2).join(".") : null,
      adm3: parts.length >= 3 ? parts.slice(0, 3).join(".") : null,
      adm4: parts.length >= 4 ? parts.slice(0, 4).join(".") : null,
    };

    const highestLevel = Object.entries(levels)
      .reverse()
      .find(([_key, value]) => value !== null);

    return {
      ...levels,
      currentLevel: highestLevel ? highestLevel[0] : "adm1",
      bmkgUrl: this.determineBMKGUrl(code),
    };
  }

  calculateSimilarity(searchQuery, targetText) {
    const query = searchQuery.toLowerCase();
    const target = targetText.toLowerCase();

    const queryWords = query.split(" ").filter((w) => w.length > 0);
    const targetWords = target.split(" ").filter((w) => w.length > 0);

    let wordMatchScore = 0;
    let exactMatchBonus = 0;

    for (const queryWord of queryWords) {
      let bestWordScore = 0;

      for (const targetWord of targetWords) {
        if (queryWord === targetWord) {
          bestWordScore = 1;
          exactMatchBonus += 0.2;
          break;
        }

        if (targetWord.includes(queryWord) || queryWord.includes(targetWord)) {
          const matchLength = Math.min(queryWord.length, targetWord.length);
          const maxLength = Math.max(queryWord.length, targetWord.length);
          const partialScore = matchLength / maxLength;
          bestWordScore = Math.max(bestWordScore, partialScore);
        }
      }

      wordMatchScore += bestWordScore;
    }

    const normalizedWordScore = wordMatchScore / queryWords.length;
    return normalizedWordScore + exactMatchBonus;
  }

  async searchWilayah(query) {
    try {
      const response = await axios.get(this.baseUrl, { timeout: 30000 });
      const data = response.data;
      const rows = data.split("\n");

      const results = [];

      for (const row of rows) {
        if (!row.trim()) continue;

        const [kode, nama] = row.split(",");
        if (!nama) continue;

        const similarity = this.calculateSimilarity(query, nama);
        const threshold = query.length <= 4 ? 0.4 : 0.3;

        if (similarity > threshold) {
          const wilayahInfo = this.parseWilayahCode(kode);
          results.push({
            kode,
            nama,
            score: similarity,
            ...wilayahInfo,
          });
        }
      }

      results.sort((a, b) => b.score - a.score);

      return results.slice(0, 10);
    } catch (error) {
      throw new ValidationError("Failed to search wilayah data", 500);
    }
  }

  async getWeatherData(wilayahCode) {
    try {
      const url = this.determineBMKGUrl(wilayahCode);
      const response = await axios.get(url, { timeout: 30000 });
      return response.data.data;
    } catch (error) {
      throw new ValidationError("Failed to get weather data", 500);
    }
  }

  async scrape(query) {
    try {
      const wilayahResults = await this.searchWilayah(query);

      if (wilayahResults.length > 0) {
        const topResult = wilayahResults[0];
        const weatherData = await this.getWeatherData(topResult.kode);

        return {
          wilayah: topResult,
          weather: weatherData,
        };
      }
      return null;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ValidationError("Failed to get weather data", 500);
    }
  }
}

router.get("/api/info/cuaca", asyncHandler(async (req, res) => {
  const { q, search, query } = req.query;
  const searchQuery = q || search || query;

  const validation = validate.fields({ q: searchQuery }, {
    q: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const service = new WeatherService();
  const result = await service.scrape(searchQuery.trim());

  sendSuccessResponse(res, {
    search_query: searchQuery,
    ...result
  });
}));

router.post("/api/info/cuaca", asyncHandler(async (req, res) => {
  const { q, search, query } = req.body;
  const searchQuery = q || search || query;

  const validation = validate.fields({ q: searchQuery }, {
    q: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const service = new WeatherService();
  const result = await service.scrape(searchQuery.trim());

  sendSuccessResponse(res, {
    search_query: searchQuery,
    ...result
  });
}));

router.metadata = {
  name: "Weather Information (BMKG)",
  path: "/api/info/cuaca",
  methods: ['GET', 'POST'],
  category: "INFO",
  description: "Get weather information based on location query. Searches for administrative regions and retrieves current weather data from BMKG (Indonesian Agency for Meteorology, Climatology, and Geophysics).",
  params: [
    {
      name: "q",
      type: "text",
      required: true,
      placeholder: "Jakarta",
      description: "Location query (also accepts: search, query)",
    },
  ],
};

module.exports = router;