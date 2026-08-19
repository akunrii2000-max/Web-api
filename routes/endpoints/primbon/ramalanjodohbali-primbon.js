'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse, CHANNEL } = require('../../../config/apikeyConfig');

const router = Router();

async function scrapeRamalanJodohBali(nama1, tgl1, bln1, thn1, nama2, tgl2, bln2, thn2) {
  try {
    const response = await axios({
      url: "https://www.primbon.com/ramalan_jodoh_bali.php",
      methods: ['POST'],
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      data: new URLSearchParams({
        nama1,
        tgl1,
        bln1,
        thn1,
        nama2,
        tgl2,
        bln2,
        thn2,
        submit: " Submit! ",
      }),
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);
    const fetchText = $("#body").text();

    let hasil;
    try {
      hasil = {
        nama_anda: {
          nama: nama1,
          tgl_lahir: fetchText.split("Hari Lahir: ")[1].split("Nama")[0].trim(),
        },
        nama_pasangan: {
          nama: nama2,
          tgl_lahir: fetchText.split(nama2 + "Hari Lahir: ")[1].split("HASILNYA MENURUT PAL SRI SEDANAI")[0].trim(),
        },
        result: fetchText.split("HASILNYA MENURUT PAL SRI SEDANAI. ")[1].split("Konsultasi Hari Baik Akad Nikah >>>")[0].trim(),
        catatan: "Untuk melihat kecocokan jodoh dengan pasangan, dapat dikombinasikan dengan Ramalan Jodoh (Jawa), numerologi Kecocokan Cinta, dan makna dari Tanggal Jadian/Pernikahan.",
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

router.get("/api/primbon/ramalan_jodoh_bali", asyncHandler(async (req, res) => {
  const { nama1, tgl1, bln1, thn1, nama2, tgl2, bln2, thn2 } = req.query;

  if (!nama1 || !tgl1 || !bln1 || !thn1 || !nama2 || !tgl2 || !bln2 || !thn2) {
    throw new ValidationError("All parameters are required", 400);
  }

  const result = await scrapeRamalanJodohBali(nama1.trim(), tgl1, bln1, thn1, nama2.trim(), tgl2, bln2, thn2);

  res.json({
    success: true,
    creator: "dongtube",
    results: result,
    channel: CHANNEL
  });
}));

router.post("/api/primbon/ramalan_jodoh_bali", asyncHandler(async (req, res) => {
  const { nama1, tgl1, bln1, thn1, nama2, tgl2, bln2, thn2 } = req.body;

  if (!nama1 || !tgl1 || !bln1 || !thn1 || !nama2 || !tgl2 || !bln2 || !thn2) {
    throw new ValidationError("All parameters are required", 400);
  }

  const result = await scrapeRamalanJodohBali(
    nama1.trim(),
    tgl1.toString(),
    bln1.toString(),
    thn1.toString(),
    nama2.trim(),
    tgl2.toString(),
    bln2.toString(),
    thn2.toString()
  );

  res.json({
    success: true,
    creator: "dongtube",
    results: result,
    channel: CHANNEL
  });
}));

router.metadata = {
  name: "Ramalan Jodoh Bali",
  path: "/api/primbon/ramalan_jodoh_bali",
  methods: ['GET', 'POST'],
  category: "PRIMBON",
  description: "Balinese Primbon-based marriage compatibility prediction using Pal Sri Sedanai method.",
  params: [
    {
      name: "nama1",
      type: "text",
      required: true,
      placeholder: "putu",
      description: "First person's name",
    },
    {
      name: "tgl1",
      type: "text",
      required: true,
      placeholder: "16",
      description: "First person's birth day (1-31)",
    },
    {
      name: "bln1",
      type: "text",
      required: true,
      placeholder: "11",
      description: "First person's birth month (1-12)",
    },
    {
      name: "thn1",
      type: "text",
      required: true,
      placeholder: "2007",
      description: "First person's birth year",
    },
    {
      name: "nama2",
      type: "text",
      required: true,
      placeholder: "keyla",
      description: "Second person's name",
    },
    {
      name: "tgl2",
      type: "text",
      required: true,
      placeholder: "1",
      description: "Second person's birth day (1-31)",
    },
    {
      name: "bln2",
      type: "text",
      required: true,
      placeholder: "1",
      description: "Second person's birth month (1-12)",
    },
    {
      name: "thn2",
      type: "text",
      required: true,
      placeholder: "2008",
      description: "Second person's birth year",
    },
  ],
};

module.exports = router;