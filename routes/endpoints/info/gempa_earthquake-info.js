'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

const URLs = {
  auto: "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json",
  terkini: "https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json",
  dirasakan: "https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json",
};

const BASE_SHAKEMAP_URL = "https://data.bmkg.go.id/DataMKG/TEWS/";

async function fetchEarthquakeData(url) {
  try {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    const data = response.data;
    const cleanText = JSON.stringify(data).replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

    return JSON.parse(cleanText);
  } catch (error) {
    throw new ValidationError(
      `Error fetching earthquake data: ${error.message}`,
      500
    );
  }
}

function addShakemapUrls(data) {
  if (!data) return data;

  function addShakemapToGempa(gempa) {
    if (!gempa || !gempa.Shakemap) return gempa;

    return {
      ...gempa,
      downloadShakemap: `${BASE_SHAKEMAP_URL}${gempa.Shakemap}`,
    };
  }

  if (data.Infogempa) {
    if (data.Infogempa.gempa) {
      if (Array.isArray(data.Infogempa.gempa)) {
        return {
          ...data,
          Infogempa: {
            ...data.Infogempa,
            gempa: data.Infogempa.gempa.map(addShakemapToGempa),
          },
        };
      } else {
        return {
          ...data,
          Infogempa: {
            ...data.Infogempa,
            gempa: addShakemapToGempa(data.Infogempa.gempa),
          },
        };
      }
    }
  }

  return data;
}

async function scrapeEarthquakeData() {
  try {
    const [autoData, terkiniData, dirasakanData] = await Promise.all([
      fetchEarthquakeData(URLs.auto),
      fetchEarthquakeData(URLs.terkini),
      fetchEarthquakeData(URLs.dirasakan),
    ]);

    return {
      auto: addShakemapUrls(autoData),
      terkini: addShakemapUrls(terkiniData),
      dirasakan: addShakemapUrls(dirasakanData),
    };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(
      "Failed to fetch earthquake data from BMKG",
      500
    );
  }
}

router.get("/api/info/bmkg", asyncHandler(async (req, res) => {
  const result = await scrapeEarthquakeData();

  sendSuccessResponse(res, result);
}));

router.post("/api/info/bmkg", asyncHandler(async (req, res) => {
  const result = await scrapeEarthquakeData();

  sendSuccessResponse(res, result);
}));

router.metadata = {
  name: "BMKG Earthquake Data",
  path: "/api/info/bmkg",
  methods: ['GET', 'POST'],
  category: "INFO",
  description: "Get latest earthquake information from BMKG (Indonesian Agency for Meteorology, Climatology, and Geophysics). Returns automatic earthquakes, recent earthquakes, and felt earthquakes with shakemap data.",
  params: [
  ],
};

module.exports = router;