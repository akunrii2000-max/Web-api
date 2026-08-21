'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function searchKodepos(location) {
  try {
    const response = await axios.post(
      "https://kodepos.posindonesia.co.id/CariKodepos",
      new URLSearchParams({ kodepos: location }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Cookie": "ci_session=aqlrvi6tdfajmfelsla8n974p1btd9pb"
        },
        timeout: 30000
      }
    );

    const $ = cheerio.load(response.data);
    const results = [];

    $("tbody > tr").each((_, el) => {
      const $td = $(el).find("td");
      results.push({
        kodepos: $td.eq(1).text().trim(),
        desa: $td.eq(2).text().trim(),
        kecamatan: $td.eq(3).text().trim(),
        kota: $td.eq(4).text().trim(),
        provinsi: $td.eq(5).text().trim()
      });
    });

    if (results.length === 0) {
      throw new ValidationError("No postal code information found", 404);
    }

    return results;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || "Failed to search postal code", 500);
  }
}

router.get("/api/tools/kodepos", asyncHandler(async (req, res) => {
  const { form, location, query } = req.query;
  const searchQuery = form || location || query;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const results = await searchKodepos(searchQuery.trim());
  sendSuccessResponse(res, {
    query: searchQuery,
    total: results.length,
    results: results
  });
}));

router.post("/api/tools/kodepos", asyncHandler(async (req, res) => {
  const { form, location, query } = req.body;
  const searchQuery = form || location || query;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const results = await searchKodepos(searchQuery.trim());
  sendSuccessResponse(res, {
    query: searchQuery,
    total: results.length,
    results: results
  });
}));

router.metadata = {
  name: "Kodepos (Indonesian Postal Code) Lookup",
  path: "/api/tools/kodepos",
  methods: ['GET', 'POST'],
  category: "TOOLS",
  description: "Search Indonesian postal code information by location name. Returns kodepos, village, district, city, and province.",
  params: [
    {
      name: "form",
      type: "text",
      required: true,
      placeholder: "pasiran jaya",
      description: "Location name to search (also accepts: location, query)",
    },
  ],
};

module.exports = router;