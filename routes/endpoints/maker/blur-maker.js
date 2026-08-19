'use strict';

const { Router } = require('express');
const axios = require('axios');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

let createCanvas, loadImage, registerFont;
try { const canvas = require('canvas'); createCanvas = canvas.createCanvas; loadImage = canvas.loadImage; registerFont = canvas.registerFont; } catch(e) { createCanvas = loadImage = registerFont = function() { throw new Error('Canvas module not installed. Run: npm install canvas'); }; }

async function generateBlurFromURL(imageURL) {
  try {
    const img = await loadImage(imageURL);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width / 4, canvas.height / 4);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      canvas,
      0,
      0,
      canvas.width / 4,
      canvas.height / 4,
      0,
      0,
      canvas.width + 5,
      canvas.height + 5
    );

    return canvas.toBuffer();
  } catch (error) {
    throw new ValidationError("Failed to process image from URL", 400);
  }
}

async function generateBlurFromBuffer(imageBuffer) {
  try {
    const img = await loadImage(imageBuffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width / 4, canvas.height / 4);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      canvas,
      0,
      0,
      canvas.width / 4,
      canvas.height / 4,
      0,
      0,
      canvas.width + 5,
      canvas.height + 5
    );

    return canvas.toBuffer();
  } catch (error) {
    throw new ValidationError("Failed to process image from file", 400);
  }
}

router.get("/api/m/blur", asyncHandler(async (req, res) => {
  const { image } = req.query;

  const validation = validate.fields({ image }, {
    image: { required: true, type: "url" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const imageBuffer = await generateBlurFromURL(image.trim());

  res.set("Content-Type", "image/png");
  res.set("Content-Length", imageBuffer.length);
  res.set("Cache-Control", "public, max-age=3600");
  res.send(imageBuffer);
}));

router.post("/api/m/blur", asyncHandler(async (req, res) => {

  const { image } = req.body;

  const validation = validate.fields({ image }, {
    image: { required: true, type: "url" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const imageBuffer = await generateBlurFromURL(image.trim());

  res.set("Content-Type", "image/png");
  res.set("Content-Length", imageBuffer.length);
  res.set("Cache-Control", "public, max-age=3600");
  res.send(imageBuffer);
}));

router.metadata = {
  name: "Blur Image Effect",
  path: "/api/m/blur",
  methods: ['GET', 'POST'],
  category: "MAKER",
  description: "Apply blur effect to images. Takes an image URL and returns the blurred version as PNG.",
  params: [
    {
      name: "image",
      type: "text",
      required: true,
      placeholder: "https://example.com/image.jpg",
      description: "Image URL to apply blur effect",
    },
  ],
};

module.exports = router;