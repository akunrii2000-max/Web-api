'use strict';

const { Router } = require('express');
const QRCode = require('qrcode');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function generateQRCode(text) {
  try {
    return new Promise((resolve, reject) => {
      QRCode.toBuffer(text, {
        errorCorrectionLevel: "H",
        type: "png",
        quality: 1,
        width: 1024,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" }
      }, (err, buffer) => {
        if (err) reject(new ValidationError("Failed to generate QR code", 500));
        else resolve(buffer);
      });
    });
  } catch (error) {
    throw new ValidationError(error.message || "Failed to generate QR code", 500);
  }
}

router.get("/api/tools/text2qr", asyncHandler(async (req, res) => {
  const { text } = req.query;

  const validation = validate.fields({ text }, {
    text: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const buffer = await generateQRCode(text.trim());

  res.set("Content-Type", "image/png");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(buffer);
}));

router.post("/api/tools/text2qr", asyncHandler(async (req, res) => {
  const { text } = req.body;

  const validation = validate.fields({ text }, {
    text: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const buffer = await generateQRCode(text.trim());

  res.set("Content-Type", "image/png");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(buffer);
}));

router.metadata = {
  name: "Text to QR Code",
  path: "/api/tools/text2qr",
  methods: ['GET', 'POST'],
  category: "TOOLS",
  description: "Generate QR code from text. Returns PNG image with high quality (1024x1024) and error correction level H.",
  responseBinary: true,
  params: [
    {
      name: "text",
      type: "text",
      required: true,
      placeholder: "Hello World",
      description: "Text to convert to QR code",
    },
  ],
};

module.exports = router;