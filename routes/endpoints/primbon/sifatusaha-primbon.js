'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse, CHANNEL } = require('../../../config/apikeyConfig');

const router = Router();

async function scrapeSifatUsahaBisnis(tgl, bln, thn) {
  try {
    const response = await axios({
      url: "https://primbon.com/sifat_usaha_bisnis.php",
      methods: ['POST'],
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      data: new URLSearchParams({
        tgl,
        bln,
        thn,
        submit: " Submit! ",
      }),
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);
    const fetchText = $("#body").text();

    let hasil;
    try {
      hasil = {
        hari_lahir: fetchText.split("Hari Lahir Anda: ")[1].split(thn)[0].trim(),
        usaha: fetchText.split(thn)[1].split("< Hitung Kembali")[0].trim(),
        catatan: "Setiap manusia memiliki sifat atau karakter yang berbeda-beda dalam menjalankan bisnis atau usaha. Dengan memahami sifat bisnis kita, akan membantu kita memperbaiki diri atau menjalin hubungan kerjasama yang lebih baik.",
      };
    } catch (e) {
      hasil = {
        status: false,
        message: "Error, Mungkin Input Yang Anda Masukkan Salah",
      };
    }
    return hasil;
  } catch (error) {
    console.error("API Error:", error.message);
    throw new ValidationError("Failed to get response from API", 500);
  }
}

router.get("/api/primbon/sifat_usaha_bisnis", asyncHandler(async (req, res) => {
  const { tgl, bln, thn } = req.query;

  if (!tgl || !bln || !thn) {
    throw new ValidationError("Parameters 'tgl', 'bln', and 'thn' are required", 400);
  }

  const parsedTgl = parseInt(tgl, 10);
  const parsedBln = parseInt(bln, 10);
  const parsedThn = parseInt(thn, 10);

  if (isNaN(parsedTgl) || isNaN(parsedBln) || isNaN(parsedThn)) {
    throw new ValidationError("Date parameters must be valid numbers", 400);
  }

  if (parsedTgl < 1 || parsedTgl > 31) {
    throw new ValidationError("Day must be between 1 and 31", 400);
  }

  if (parsedBln < 1 || parsedBln > 12) {
    throw new ValidationError("Month must be between 1 and 12", 400);
  }

  const currentYear = new Date().getFullYear();
  if (parsedThn < 1900 || parsedThn > currentYear) {
    throw new ValidationError(`Year must be between 1900 and ${currentYear}`, 400);
  }

  const result = await scrapeSifatUsahaBisnis(parsedTgl.toString(), parsedBln.toString(), parsedThn.toString());

  res.json({
    success: true,
    creator: "dongtube",
    results: result,
    channel: CHANNEL
  });
}));

router.post("/api/primbon/sifat_usaha_bisnis", asyncHandler(async (req, res) => {
  const { tgl, bln, thn } = req.body;

  if (!tgl || !bln || !thn) {
    throw new ValidationError("Parameters 'tgl', 'bln', and 'thn' are required", 400);
  }

  if (isNaN(tgl) || isNaN(bln) || isNaN(thn)) {
    throw new ValidationError("Date parameters must be valid numbers", 400);
  }

  if (tgl < 1 || tgl > 31) {
    throw new ValidationError("Day must be between 1 and 31", 400);
  }

  if (bln < 1 || bln > 12) {
    throw new ValidationError("Month must be between 1 and 12", 400);
  }

  const currentYear = new Date().getFullYear();
  if (thn < 1900 || thn > currentYear) {
    throw new ValidationError(`Year must be between 1900 and ${currentYear}`, 400);
  }

  const result = await scrapeSifatUsahaBisnis(tgl.toString(), bln.toString(), thn.toString());

  res.json({
    success: true,
    creator: "dongtube",
    results: result,
    channel: CHANNEL
  });
}));

router.metadata = {
  name: "Sifat Usaha Bisnis",
  path: "/api/primbon/sifat_usaha_bisnis",
  methods: ['GET', 'POST'],
  category: "PRIMBON",
  description: "Business characteristics and suitability based on birth date from Primbon.",
  params: [
    {
      name: "tgl",
      type: "text",
      required: true,
      placeholder: "1",
      description: "Birth day (1-31)",
    },
    {
      name: "bln",
      type: "text",
      required: true,
      placeholder: "1",
      description: "Birth month (1-12)",
    },
    {
      name: "thn",
      type: "text",
      required: true,
      placeholder: "2000",
      description: "Birth year (1900-current year)",
    },
  ],
};

module.exports = router;