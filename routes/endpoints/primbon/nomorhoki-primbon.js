'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse, CHANNEL } = require('../../../config/apikeyConfig');

const router = Router();

async function scrapeNomorHoki(phoneNumber) {
  try {
    const response = await axios.post(
      "https://www.primbon.com/no_hoki_bagua_shuzi.php",
      `nomer=${phoneNumber}&submit=+Submit%21+`,
      {
        headers: {
          authority: "www.primbon.com",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "content-type": "application/x-www-form-urlencoded",
          origin: "https://www.primbon.com",
          referer: "https://www.primbon.com/no_hoki_bagua_shuzi.php",
          "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36",
        },
        timeout: 10000,
      }
    );

    const $ = cheerio.load(response.data);

    const extractNumber = (text) => {
      const matches = text.match(/\d+(\.\d+)?/);
      return matches ? parseFloat(matches[0]) : 0;
    };

    const nomorHPElement = $('b:contains("No. HP")').text();
    const baguaShuziText = $('b:contains("% Angka Bagua Shuzi")').text();

    if (!nomorHPElement || !baguaShuziText) {
      throw new ValidationError("Failed to extract data from response", 500);
    }

    const result = {
      nomor: nomorHPElement.replace("No. HP : ", "").trim(),
      angka_bagua_shuzi: {
        value: extractNumber(baguaShuziText),
        description: "Persentase Angka Bagua Shuzi menunjukkan tingkat kecocokan nomor dengan elemen karakter. Nilai minimal yang baik adalah 60%.",
      },
      energi_positif: {
        value: extractNumber($('b:contains("%")').first().text()),
        description: "Energi positif mempengaruhi aspek kekayaan, kesehatan, cinta/relasi, dan kestabilan dalam hidup.",
      },
      energi_negatif: {
        value: extractNumber($('b:contains("%")').last().text()),
        description: "Energi negatif menunjukkan potensi hambatan. Semakin rendah nilainya, semakin baik.",
      },
    };

    result.analisis = {
      status: result.energi_positif.value > 60 && result.angka_bagua_shuzi.value >= 60,
      description: "Nomor dianggap hoki jika Energi Positif di atas 60% dan Angka Bagua Shuzi minimal 60%",
    };

    return result;
  } catch (error) {
    console.error("API Error:", error.message);
    throw new ValidationError("Failed to get response from API", 500);
  }
}

router.get("/api/primbon/nomorhoki", asyncHandler(async (req, res) => {
  const { phoneNumber } = req.query;

  if (!phoneNumber || typeof phoneNumber !== "string" || !/^\d+$/.test(phoneNumber.trim())) {
    throw new ValidationError("Invalid phone number format. Use numbers only", 400);
  }

  if (phoneNumber.trim().length < 8 || phoneNumber.trim().length > 15) {
    throw new ValidationError("Phone number must be between 8 and 15 digits", 400);
  }

  const result = await scrapeNomorHoki(phoneNumber.trim());

  res.json({
    success: true,
    creator: "dongtube",
    results: result,
    channel: CHANNEL
  });
}));

router.post("/api/primbon/nomorhoki", asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber || typeof phoneNumber !== "string" || !/^\d+$/.test(phoneNumber.trim())) {
    throw new ValidationError("Invalid phone number format. Use numbers only", 400);
  }

  if (phoneNumber.trim().length < 8 || phoneNumber.trim().length > 15) {
    throw new ValidationError("Phone number must be between 8 and 15 digits", 400);
  }

  const result = await scrapeNomorHoki(phoneNumber.trim());

  res.json({
    success: true,
    creator: "dongtube",
    results: result,
    channel: CHANNEL
  });
}));

router.metadata = {
  name: "Nomor Hoki",
  path: "/api/primbon/nomorhoki",
  methods: ['GET', 'POST'],
  category: "PRIMBON",
  description: "Determine lucky status of phone numbers based on Primbon's Bagua Shuzi and energy calculations.",
  params: [
    {
      name: "phoneNumber",
      type: "text",
      required: true,
      placeholder: "6285658939117",
      description: "Phone number to check (numbers only, 8-15 digits)",
    },
  ],
};

module.exports = router;