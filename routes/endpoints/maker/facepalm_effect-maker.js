'use strict';

const { Router } = require('express');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

let createCanvas, loadImage, registerFont;
try { const canvas = require('canvas'); createCanvas = canvas.createCanvas; loadImage = canvas.loadImage; registerFont = canvas.registerFont; } catch(e) { createCanvas = loadImage = registerFont = function() { throw new Error('Canvas module not installed. Run: npm install canvas'); }; }

async function generateFacepalmFromURL(imageURL) {
  try {
    const avatar = await loadImage(imageURL);
    const canvas = createCanvas(632, 357);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 632, 357);
    ctx.drawImage(avatar, 199, 112, 235, 235);

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(199, 112, 235, 235);

    return canvas.toBuffer();
  } catch (error) {
    throw new ValidationError("Failed to process image from URL", 400);
  }
}

async function generateFacepalmFromBuffer(imageBuffer) {
  try {
    const avatar = await loadImage(imageBuffer);
    const canvas = createCanvas(632, 357);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 632, 357);
    ctx.drawImage(avatar, 199, 112, 235, 235);

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(199, 112, 235, 235);

    return canvas.toBuffer();
  } catch (error) {
    throw new ValidationError("Failed to process image from file", 400);
  }
}

router.get("/api/m/facepalm", asyncHandler(async (req, res) => {
  const { image } = req.query;

  const validation = validate.fields({ image }, {
    image: { required: true, type: "url" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const imageBuffer = await generateFacepalmFromURL(image.trim());

  res.set("Content-Type", "image/png");
  res.set("Content-Length", imageBuffer.length);
  res.set("Cache-Control", "public, max-age=3600");
  res.send(imageBuffer);
}));

router.post("/api/m/facepalm", asyncHandler(async (req, res) => {
  const { image } = req.body;

  const validation = validate.fields({ image }, {
    image: { required: true, type: "url" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const imageBuffer = await generateFacepalmFromURL(image.trim());

  res.set("Content-Type", "image/png");
  res.set("Content-Length", imageBuffer.length);
  res.set("Cache-Control", "public, max-age=3600");
  res.send(imageBuffer);
}));

router.metadata = {
  name: "Facepalm Effect",
  path: "/api/m/facepalm",
  methods: ['GET', 'POST'],
  category: "MAKER",
  description: "Apply facepalm effect to images. Takes an image URL and returns the image with facepalm overlay.",
  params: [
    {
      name: "image",
      type: "text",
      required: true,
      placeholder: "https://example.com/image.jpg",
      description: "Image URL to apply facepalm effect",
    },
  ],
};

module.exports = router;