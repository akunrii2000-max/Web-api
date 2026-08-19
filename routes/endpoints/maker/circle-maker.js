'use strict';

const { Router } = require('express');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

let createCanvas, loadImage, registerFont;
try { const canvas = require('canvas'); createCanvas = canvas.createCanvas; loadImage = canvas.loadImage; registerFont = canvas.registerFont; } catch(e) { createCanvas = loadImage = registerFont = function() { throw new Error('Canvas module not installed. Run: npm install canvas'); }; }

function applyCircleMask(ctx, width, height) {
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

async function generateCircleFromURL(imageURL) {
  try {
    const img = await loadImage(imageURL);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0);
    applyCircleMask(ctx, canvas.width, canvas.height);

    return canvas.toBuffer("image/png");
  } catch (error) {
    throw new ValidationError("Failed to process image from URL", 400);
  }
}

async function generateCircleFromBuffer(imageBuffer) {
  try {
    const img = await loadImage(imageBuffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0);
    applyCircleMask(ctx, canvas.width, canvas.height);

    return canvas.toBuffer("image/png");
  } catch (error) {
    throw new ValidationError("Failed to process image from file", 400);
  }
}

router.get("/api/m/circle", asyncHandler(async (req, res) => {
  const { image } = req.query;

  const validation = validate.fields({ image }, {
    image: { required: true, type: "url" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const imageBuffer = await generateCircleFromURL(image.trim());

  res.set("Content-Type", "image/png");
  res.set("Content-Length", imageBuffer.length);
  res.set("Cache-Control", "public, max-age=3600");
  res.send(imageBuffer);
}));

router.post("/api/m/circle", asyncHandler(async (req, res) => {
  const { image } = req.body;

  const validation = validate.fields({ image }, {
    image: { required: true, type: "url" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const imageBuffer = await generateCircleFromURL(image.trim());

  res.set("Content-Type", "image/png");
  res.set("Content-Length", imageBuffer.length);
  res.set("Cache-Control", "public, max-age=3600");
  res.send(imageBuffer);
}));

router.metadata = {
  name: "Circle Mask Effect",
  path: "/api/m/circle",
  methods: ['GET', 'POST'],
  category: "MAKER",
  description: "Apply circular mask to images. Takes an image URL and returns the image with circular mask applied.",
  params: [
    {
      name: "image",
      type: "text",
      required: true,
      placeholder: "https://example.com/image.jpg",
      description: "Image URL to apply circle mask",
    },
  ],
};

module.exports = router;