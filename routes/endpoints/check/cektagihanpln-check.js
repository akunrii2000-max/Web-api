'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function checkPLNBill(nopel) {
  try {
    const response = await axios.get(
      `https://listrik.okcek.com/dd.php?nopel=${nopel}`,
      {
        headers: {
          authority: "listrik.okcek.com",
          accept: "application/json, text/javascript, */*; q=0.01",
          "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
          referer: `https://listrik.okcek.com/hasil.php?nopel=${nopel}`,
          "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132"',
          "sec-ch-ua-mobile": "?1",
          "sec-ch-ua-platform": '"Android"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "user-agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36",
          "x-requested-with": "XMLHttpRequest",
        },
        timeout: 30000,
      }
    );

    const rawData = response.data;

    if (rawData?.data?.status !== "success") {
      throw new ValidationError("Data not found (Data tidak ditemukan)", 404);
    }

    return {
      jenis_tagihan: rawData.data[0][2],
      no_pelanggan: rawData.data[1][2],
      nama_pelanggan: rawData.data[2][2],
      tarif_daya: rawData.data[3][2],
      bulan_tahun: rawData.data[4][2],
      stand_meter: rawData.data[5][2],
      total_tagihan: rawData.data[6][2],
    };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(
      error.message || "Failed to check PLN bill",
      500
    );
  }
}

router.get("/api/check/tagihanpln", asyncHandler(async (req, res) => {
  const { nopel } = req.query;

  const validation = validate.fields({ nopel }, {
    nopel: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await checkPLNBill(nopel.trim());

  sendSuccessResponse(res, {
    nopel: nopel,
    ...result
  });
}));

router.post("/api/check/tagihanpln", asyncHandler(async (req, res) => {
  const { nopel } = req.body;

  const validation = validate.fields({ nopel }, {
    nopel: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await checkPLNBill(nopel.trim());

  sendSuccessResponse(res, {
    nopel: nopel,
    ...result
  });
}));

router.metadata = {
  name: "Check PLN Electricity Bill",
  path: "/api/check/tagihanpln",
  methods: ['GET', 'POST'],
  category: "CHECK",
  description: "Check PLN electricity bill information using customer number (nopel). Returns bill type, customer details, tariff information, meter readings, and total bill amount.",
  params: [
    {
      name: "nopel",
      type: "text",
      required: true,
      placeholder: "443100003506",
      description: "PLN customer number (nomor pelanggan PLN)",
    },
  ],
};

module.exports = router;