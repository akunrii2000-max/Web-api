'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse, CHANNEL } = require('../../../config/apikeyConfig');

const router = Router();

async function scrapeArtiNama(nama) {
  try {
    const response = await axios.get(
      `https://primbon.com/arti_nama.php?nama1=${nama}&proses=+Submit%21+`,
      {
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    const $ = cheerio.load(response.data);
    const fetchText = $("#body").text();

    let hasil;
    try {
      hasil = {
        nama,
        arti: fetchText.split("memiliki arti: ")[1].split("Nama:")[0].trim(),
        catatan: "Gunakan juga aplikasi numerologi Kecocokan Nama, untuk melihat sejauh mana keselarasan nama anda dengan diri anda.",
      };
    } catch (e) {
      hasil = {
        status: false,
        message: `Tidak ditemukan arti nama "${nama}". Cari dengan kata kunci yang lain.`,
      };
    }
    return hasil;
  } catch (error) {
    console.error("API Error:", error.message);
    throw new ValidationError("Failed to get response from API", 500);
  }
}

router.get("/api/primbon/arti_nama", asyncHandler(async (req, res) => {
  const { nama } = req.query;

  if (!nama || typeof nama !== "string" || nama.trim().length === 0) {
    throw new ValidationError("Parameter 'nama' is required and must be a non-empty string", 400);
  }

  const result = await scrapeArtiNama(nama.trim());

  res.json({
    success: true,
    creator: "dongtube",
    results: result,
    channel: CHANNEL
  });
}));

router.post("/api/primbon/arti_nama", asyncHandler(async (req, res) => {
  const { nama } = req.body;

  if (!nama || typeof nama !== "string" || nama.trim().length === 0) {
    throw new ValidationError("Parameter 'nama' is required and must be a non-empty string", 400);
  }

  const result = await scrapeArtiNama(nama.trim());

  res.json({
    success: true,
    creator: "dongtube",
    results: result,
    channel: CHANNEL
  });
}));

router.metadata = {
  name: "Arti Nama",
  path: "/api/primbon/arti_nama",
  methods: ['GET', 'POST'],
  category: "PRIMBON",
  description: "Retrieve the meaning of a given name from Primbon database with compatibility notes.",
  params: [
    {
      name: "nama",
      type: "text",
      required: true,
      placeholder: "putu",
      description: "Name to search for meaning",
    },
  ],
};

module.exports = router;