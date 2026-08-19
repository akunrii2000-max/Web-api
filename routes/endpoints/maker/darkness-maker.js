'use strict';

const { Router } = require('express');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

let createCanvas, loadImage, registerFont;
try { const canvas = require('canvas'); createCanvas = canvas.createCanvas; loadImage = canvas.loadImage; registerFont = canvas.registerFont; } catch(e) { createCanvas = loadImage = registerFont = function() { throw new Error('Canvas module not installed. Run: npm install canvas'); }; }

async function generateDarknessFromURL(imageURL, amount) {
  try {
    const img = await loadImage(imageURL);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const darknessAmount = parseInt(amount, 10) || 50;

    for (let i = 0; i < imgData.data.length; i += 4) {
      imgData.data[i] = Math.max(0, imgData.data[i] - darknessAmount);
      imgData.data[i + 1] = Math.max(0, imgData.data[i + 1] - darknessAmount);
      imgData.data[i + 2] = Math.max(0, imgData.data[i + 2] - darknessAmount);
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toBuffer("image/png");
  } catch (error) {
    throw new ValidationError("Failed to process image from URL", 400);
  }
}

async function generateDarknessFromBuffer(imageBuffer, amount) {
  try {
    const img = await loadImage(imageBuffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const darknessAmount = parseInt(amount, 10) || 50;

    for (let i = 0; i < imgData.data.length; i += 4) {
      imgData.data[i] = Math.max(0, imgData.data[i] - darknessAmount);
      imgData.data[i + 1] = Math.max(0, imgData.data[i + 1] - darknessAmount);
      imgData.data[i + 2] = Math.max(0, imgData.data[i + 2] - darknessAmount);
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toBuffer("image/png");
  } catch (error) {
    throw new ValidationError("Failed to process image from file", 400);
  }
}

router.get("/api/m/darkness", asyncHandler(async (req, res) => {
  const { image, amount } = req.query;

  const validation = validate.fields({ image }, {
    image: { required: true, type: "url" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const parsedAmount = parseInt(amount, 10);
  if (amount && (isNaN(parsedAmount) || parsedAmount < 0 || parsedAmount > 255)) {
    throw new ValidationError("Amount must be between 0 and 255", 400);
  }

  const imageBuffer = await generateDarknessFromURL(image.trim(), parsedAmount || 50);

  res.set("Content-Type", "image/png");
  res.set("Content-Length", imageBuffer.length);
  res.set("Cache-Control", "public, max-age=3600");
  res.send(imageBuffer);
}));

router.post("/api/m/darkness", asyncHandler(async (req, res) => {
  const { image, amount } = req.body;

  const validation = validate.fields({ image }, {
    image: { required: true, type: "url" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const parsedAmount = parseInt(amount, 10);
  if (amount && (isNaN(parsedAmount) || parsedAmount < 0 || parsedAmount > 255)) {
    throw new ValidationError("Amount must be between 0 and 255", 400);
  }

  const imageBuffer = await generateDarknessFromURL(image.trim(), parsedAmount || 50);

  res.set("Content-Type", "image/png");
  res.set("Content-Length", imageBuffer.length);
  res.set("Cache-Control", "public, max-age=3600");
  res.send(imageBuffer);
}));

router.metadata = {
  name: "Darkness Effect",
  path: "/api/m/darkness",
  methods: ['GET', 'POST'],
  category: "MAKER",
  description: "Apply darkness effect to images. Takes an image URL and darkness amount (0-255), returns darkened image.",
  params: [
    {
      name: "image",
      type: "text",
      required: true,
      placeholder: "https://example.com/image.jpg",
      description: "Image URL to apply darkness effect",
    },
    {
      name: "amount",
      type: "number",
      required: false,
      placeholder: "50",
      description: "Darkness amount (0-255, default: 50)",
    },
  ],
};

module.exports = router;