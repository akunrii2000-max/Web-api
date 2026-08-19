'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse, CHANNEL } = require('../../../config/apikeyConfig');

const router = Router();

async function scrapeCekPotensiPenyakit(tgl, bln, thn) {
  try {
    const response = await axios({
      url: "https://primbon.com/cek_potensi_penyakit.php",
      methods: ['POST'],
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      data: new URLSearchParams({
        tanggal: tgl,
        bulan: bln,
        tahun: thn,
        hitung: " Submit! ",
      }),
      timeout: 30000,
    });

    let $ = cheerio.load(response.data);
    let fetchText = $("#body")
      .text()
      .replace(/\s{2,}/g, " ")
      .replace(/[\n\r\t]+/g, " ")
      .replace(/\(adsbygoogle\s*=\s*window\.adsbygoogle\s*\|\|\s*\[\]\)\.push\(\{\}\); /g, "")
      .replace(/<<+\s*Kembali/g, "")
      .trim();

    if (!fetchText.includes("CEK POTENSI PENYAKIT (METODE PITAGORAS)")) {
      throw new ValidationError("Data tidak ditemukan atau format tanggal tidak valid", 400);
    }

    const hasil = {
      analisa: fetchText.split("CEK POTENSI PENYAKIT (METODE PITAGORAS)")[1].split("Sektor yg dianalisa:")[0].trim(),
      sektor: fetchText.split("Sektor yg dianalisa:")[1].split("Anda tidak memiliki elemen")[0].trim(),
      elemen: "Anda tidak memiliki elemen " + fetchText.split("Anda tidak memiliki elemen")[1].split("*")[0].trim(),
      catatan: "Potensi penyakit harus dipandang secara positif. Pencegahan adalah yang terbaik, makanan yang sehat, olahraga teratur, istirahat yang cukup, hidup bahagia.",
    };

    return hasil;
  } catch (error) {
    console.error("API Error:", error.message);
    throw new ValidationError("Failed to get response from API", 500);
  }
}

router.get("/api/primbon/cek_potensi_penyakit", asyncHandler(async (req, res) => {
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

  const result = await scrapeCekPotensiPenyakit(parsedTgl.toString(), parsedBln.toString(), parsedThn.toString());

  res.json({
    success: true,
    creator: "dongtube",
    results: result,
    channel: CHANNEL
  });
}));

router.post("/api/primbon/cek_potensi_penyakit", asyncHandler(async (req, res) => {
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

  const result = await scrapeCekPotensiPenyakit(tgl.toString(), bln.toString(), thn.toString());

  res.json({
    success: true,
    creator: "dongtube",
    results: result,
    channel: CHANNEL
  });
}));

router.metadata = {
  name: "Cek Potensi Penyakit",
  path: "/api/primbon/cek_potensi_penyakit",
  methods: ['GET', 'POST'],
  category: "PRIMBON",
  description: "Check potential disease risks based on birth date using Pythagorean method from Primbon.",
  params: [
    {
      name: "tgl",
      type: "text",
      required: true,
      placeholder: "12",
      description: "Birth day (1-31)",
    },
    {
      name: "bln",
      type: "text",
      required: true,
      placeholder: "5",
      description: "Birth month (1-12)",
    },
    {
      name: "thn",
      type: "text",
      required: true,
      placeholder: "1998",
      description: "Birth year (1900-current year)",
    },
  ],
};

module.exports = router;