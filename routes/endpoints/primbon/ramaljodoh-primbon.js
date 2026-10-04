'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse, CHANNEL } = require('../../../config/apikeyConfig');

const router = Router();

async function scrapeRamalanJodoh(nama1, tgl1, bln1, thn1, nama2, tgl2, bln2, thn2) {
  try {
    const response = await axios({
      method: "post",
      url: "https://www.primbon.com/ramalan_jodoh.php",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36",
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
        submit: "Â  RAMALAN JODOH >>Â  ",
      }),
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    const extractPerson = (index) => {
      const elements = $("#body")
        .contents()
        .filter((_, el) => el.type === "tag" && (el.name === "b" || el.name === "i"));

      return {
        nama: elements.eq(index * 2).text().trim(),
        tanggal_lahir: elements.eq(index * 2 + 1).text().replace("Tgl. Lahir:", "").trim(),
      };
    };

    const person1 = extractPerson(0);
    const person2 = extractPerson(1);

    let text = $("#body").text();
    text = text
      .replace(/\(adsbygoogle.*\);/g, "")
      .replace("RAMALAN JODOH", "")
      .replace(/Konsultasi Hari Baik Akad Nikah >>>/g, "");

    const predictionsStart = text.indexOf("1. Berdasarkan neptu");
    const predictionsEnd = text.indexOf("*Jangan mudah memutuskan");

    let predictions = [];
    if (predictionsStart !== -1 && predictionsEnd !== -1) {
      text = text.substring(predictionsStart, predictionsEnd).trim();
      predictions = text
        .split(/\d+\.\s+/)
        .filter((item) => item.trim())
        .map((item) => item.trim());
    }

    const peringatan = $("#body i")
      .filter((_, el) => $(el).text().includes("Jangan mudah memutuskan"))
      .first()
      .text()
      .split("Konsultasi")[0]
      .trim() || "No specific warning found.";

    const result = {
      orang_pertama: person1,
      orang_kedua: person2,
      deskripsi: "Hasil ramalan primbon perjodohan bagi kedua pasangan yang dihitung berdasarkan 6 petung perjodohan dari kitab primbon Betaljemur Adammakna.",
      hasil_ramalan: predictions,
      peringatan: peringatan,
    };

    return result;
  } catch (error) {
    console.error("API Error:", error.message);
    throw new ValidationError("Failed to get response from API", 500);
  }
}

router.get("/api/primbon/ramalan_jodoh", asyncHandler(async (req, res) => {
  const { nama1, tgl1, bln1, thn1, nama2, tgl2, bln2, thn2 } = req.query;

  if (!nama1 || !tgl1 || !bln1 || !thn1 || !nama2 || !tgl2 || !bln2 || !thn2) {
    throw new ValidationError("All parameters are required", 400);
  }

  const result = await scrapeRamalanJodoh(nama1.trim(), tgl1, bln1, thn1, nama2.trim(), tgl2, bln2, thn2);

  res.json({
    success: true,
    creator: "dongtube",
    results: result,
    channel: CHANNEL
  });
}));

router.post("/api/primbon/ramalan_jodoh", asyncHandler(async (req, res) => {
  const { nama1, tgl1, bln1, thn1, nama2, tgl2, bln2, thn2 } = req.body;

  if (!nama1 || !tgl1 || !bln1 || !thn1 || !nama2 || !tgl2 || !bln2 || !thn2) {
    throw new ValidationError("All parameters are required", 400);
  }

  const result = await scrapeRamalanJodoh(
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
  name: "Ramalan Jodoh",
  path: "/api/primbon/ramalan_jodoh",
  methods: ['GET', 'POST'],
  category: "PRIMBON",
  description: "Javanese Primbon-based marriage compatibility prediction using 6 petung perjodohan method.",
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