'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse, CHANNEL } = require('../../../config/apikeyConfig');

const router = Router();

async function scrapeKecocokanNamaPasangan(nama1, nama2) {
  try {
    const response = await axios.get(
      `https://primbon.com/kecocokan_nama_pasangan.php?nama1=${nama1}&nama2=${nama2}&proses=+Submit%21+`,
      {
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      }
    );

    const $ = cheerio.load(response.data);
    const fetchText = $("#body").text();

    let hasil;
    try {
      hasil = {
        nama_anda: nama1,
        nama_pasangan: nama2,
        sisi_positif: fetchText.split("Sisi Positif Anda: ")[1].split("Sisi Negatif Anda: ")[0].trim(),
        sisi_negatif: fetchText.split("Sisi Negatif Anda: ")[1].split("< Hitung Kembali")[0].trim(),
        gambar: "https://primbon.com/ramalan_kecocokan_cinta2.png",
        catatan: "Untuk melihat kecocokan jodoh dengan pasangan, dapat dikombinasikan dengan primbon Ramalan Jodoh (Jawa), Ramalan Jodoh (Bali), numerologi Kecocokan Cinta, Ramalan Perjalanan Hidup Suami Istri, dan makna dari Tanggal Jadian/Pernikahan.",
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

router.get("/api/primbon/kecocokan_nama_pasangan", asyncHandler(async (req, res) => {
  const { nama1, nama2 } = req.query;

  if (!nama1 || typeof nama1 !== "string" || nama1.trim().length === 0) {
    throw new ValidationError("Parameter 'nama1' is required and must be a non-empty string", 400);
  }

  if (!nama2 || typeof nama2 !== "string" || nama2.trim().length === 0) {
    throw new ValidationError("Parameter 'nama2' is required and must be a non-empty string", 400);
  }

  const result = await scrapeKecocokanNamaPasangan(nama1.trim(), nama2.trim());

  res.json({
    success: true,
    creator: "dongtube",
    results: result,
    channel: CHANNEL
  });
}));

router.post("/api/primbon/kecocokan_nama_pasangan", asyncHandler(async (req, res) => {
  const { nama1, nama2 } = req.body;

  if (!nama1 || typeof nama1 !== "string" || nama1.trim().length === 0) {
    throw new ValidationError("Parameter 'nama1' is required and must be a non-empty string", 400);
  }

  if (!nama2 || typeof nama2 !== "string" || nama2.trim().length === 0) {
    throw new ValidationError("Parameter 'nama2' is required and must be a non-empty string", 400);
  }

  const result = await scrapeKecocokanNamaPasangan(nama1.trim(), nama2.trim());

  res.json({
    success: true,
    creator: "dongtube",
    results: result,
    channel: CHANNEL
  });
}));

router.metadata = {
  name: "Kecocokan Nama Pasangan",
  path: "/api/primbon/kecocokan_nama_pasangan",
  methods: ['GET', 'POST'],
  category: "PRIMBON",
  description: "Check compatibility of two names according to Primbon. Returns positive and negative aspects with related image and notes.",
  params: [
    {
      name: "nama1",
      type: "text",
      required: true,
      placeholder: "putu",
      description: "First name for compatibility check",
    },
    {
      name: "nama2",
      type: "text",
      required: true,
      placeholder: "keyla",
      description: "Second name for compatibility check",
    },
  ],
};

module.exports = router;