'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function generateBratImage(text, isAnimated, delayMs) {
  try {
    const words = text.trim().split(/\s+/).slice(0, 10);
    const limitedText = words.join(" ");

    if (limitedText.length > 800) {
      throw new ValidationError("Text must be maximum 800 characters", 400);
    }

    const encodedText = encodeURIComponent(limitedText);
    const apiUrl = isAnimated
      ? `https://brat.siputzx.my.id/gif?text=${encodedText}&delay=${delayMs}`
      : `https://brat.siputzx.my.id/image?text=${encodedText}`;

    const response = await axios.get(apiUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const buffer = Buffer.from(response.data);

    return {
      buffer,
      contentType: isAnimated ? "image/gif" : "image/png",
    };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(
      error.message || "Failed to generate Brat image",
      500
    );
  }
}

router.get("/api/m/brat", asyncHandler(async (req, res) => {
  const { text, isAnimated = "false", delay = "500" } = req.query;

  const validation = validate.fields({ text }, {
    text: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  if (text.length > 800) {
    throw new ValidationError("Text must be less than 800 characters", 400);
  }

  const isAnim = String(isAnimated).toLowerCase() === "true";
  const delayMs = Math.max(100, Math.min(1500, parseInt(delay, 10) || 500));

  const result = await generateBratImage(text.trim(), isAnim, delayMs);

  res.set("Content-Type", result.contentType);
  res.set("Content-Length", result.buffer.length);
  res.set("Cache-Control", "public, max-age=3600");
  res.send(result.buffer);
}));

router.post("/api/m/brat", asyncHandler(async (req, res) => {
  const { text, isAnimated = false, delay = 500 } = req.body;

  const validation = validate.fields({ text }, {
    text: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  if (text.length > 800) {
    throw new ValidationError("Text must be less than 800 characters", 400);
  }

  const isAnim = String(isAnimated).toLowerCase() === "true";
  const delayMs = Math.max(100, Math.min(1500, parseInt(delay, 10) || 500));

  const result = await generateBratImage(text.trim(), isAnim, delayMs);

  res.set("Content-Type", result.contentType);
  res.set("Content-Length", result.buffer.length);
  res.set("Cache-Control", "public, max-age=3600");
  res.send(result.buffer);
}));

router.metadata = {
  name: "Brat Image/GIF Generator",
  path: "/api/m/brat",
  methods: ['GET', 'POST'],
  category: "MAKER",
  description: "Generate Brat images or animated GIFs from text. Create static images or animated GIFs with customizable delay between frames.",
  params: [
    {
      name: "text",
      type: "text",
      required: true,
      placeholder: "Hello World",
      description: "Text for the Brat image (max 800 characters)",
    },
    {
      name: "isAnimated",
      type: "boolean",
      required: false,
      placeholder: "false",
      description: "Generate animated GIF (default: false)",
    },
    {
      name: "delay",
      type: "number",
      required: false,
      placeholder: "500",
      description: "Delay between frames in ms (100-1500, default: 500)",
    },
  ],
};

module.exports = router;