'use strict';

const { Router } = require('express');
const axios = require('axios');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

const normalizeText = (text) => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "");
};

async function getCourierList() {
  try {
    const response = await axios.get(
      "https://loman.id/resapp/getdropdown.php",
      {
        headers: {
          "user-agent": "Postify/1.0.0",
          "content-type": "application/x-www-form-urlencoded",
        },
        timeout: 5000,
      }
    );

    if (response.data?.status !== "berhasil") {
      throw new ValidationError("Failed to retrieve courier list", 500);
    }

    return {
      success: true,
      couriers: response.data.data.map((c) => ({
        name: c.title,
        normalized: normalizeText(c.title),
      })),
    };
  } catch (error) {
    throw new ValidationError(
      error.message || "Failed to retrieve courier list",
      500
    );
  }
}

async function trackPackage(resi, courierName) {
  if (!resi || !courierName) {
    throw new ValidationError("Tracking number and courier name are required", 400);
  }

  try {
    const courierListResult = await getCourierList();
    if (!courierListResult.success) {
      throw new ValidationError("Failed to get courier list", 500);
    }

    const ni = normalizeText(courierName);
    const matchedCourier = courierListResult.couriers.find(
      (c) => c.normalized.includes(ni) || ni.includes(c.normalized)
    );

    if (!matchedCourier) {
      throw new ValidationError(
        `Courier "${courierName}" not found. Available: ${courierListResult.couriers.map((c) => c.name).join(", ")}`,
        404
      );
    }

    const data = qs.stringify({
      resi: resi,
      ex: matchedCourier.name,
    });

    const response = await axios.post(
      "https://loman.id/resapp/",
      data,
      {
        headers: {
          "user-agent": "Postify/1.0.0",
          "content-type": "application/x-www-form-urlencoded",
        },
        timeout: 10000,
      }
    );

    if (response.data?.status !== "berhasil") {
      throw new ValidationError("Failed to track package", 500);
    }

    const history = Array.isArray(response.data.history)
      ? response.data.history
          .map((item) => ({
            datetime: item.tanggal,
            description: item.details,
            timestamp: new Date(item.tanggal.replace("Pukul", "")).getTime() || null,
          }))
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      : [];

    return {
      success: true,
      courier: matchedCourier.name,
      resi: resi,
      status: response.data.details?.status || "Unknown",
      message: response.data.details?.infopengiriman || "",
      tips: response.data.details?.ucapan || "",
      history: history,
    };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || "Failed to track package", 500);
  }
}

router.get("/api/check/resi", asyncHandler(async (req, res) => {
  const { resi, courier } = req.query;

  const validation = validate.fields(
    { resi, courier },
    {
      resi: { required: true, type: "string" },
      courier: { required: true, type: "string" },
    }
  );

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await trackPackage(resi.trim(), courier.trim());

  sendSuccessResponse(res, result);
}));

router.post("/api/check/resi", asyncHandler(async (req, res) => {
  const { resi, courier } = req.body;

  const validation = validate.fields(
    { resi, courier },
    {
      resi: { required: true, type: "string" },
      courier: { required: true, type: "string" },
    }
  );

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await trackPackage(resi.trim(), courier.trim());

  sendSuccessResponse(res, result);
}));

router.metadata = {
  name: "Check Resi (Package Tracking)",
  path: "/api/check/resi",
  methods: ['GET', 'POST'],
  category: "CHECK",
  description: "Track package shipments using tracking number (resi) and courier name. Returns shipping status, history, and tracking details from Indonesian shipping couriers.",
  params: [
    {
      name: "resi",
      type: "text",
      required: true,
      placeholder: "1234567890",
      description: "Tracking number (nomor resi)",
    },
    {
      name: "courier",
      type: "text",
      required: true,
      placeholder: "JNE",
      description: "Courier name (nama ekspedisi)",
    },
  ],
};

module.exports = router;