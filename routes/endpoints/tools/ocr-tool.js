'use strict';

const { Router } = require('express');
const axios = require('axios');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function ocrImage(url) {
  if (!validate.url(url)) {
    throw new ValidationError("Invalid image URL", 400);
  }

  try {
    const imgResponse = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000
    });

    const imageBase64 = Buffer.from(imgResponse.data).toString("base64");
    const ext = url.split('.').pop().toLowerCase();
    const mimeType = ext === "png" ? "image/png" : "image/jpeg";

    const ocrResponse = await axios.post(
      "https://staging-ai-image-ocr-266i.frontend.encr.app/api/ocr/process",
      { imageBase64, mimeType },
      {
        headers: { "content-type": "application/json" },
        timeout: 60000
      }
    );

    if (!ocrResponse.data || !ocrResponse.data.extractedText) {
      throw new ValidationError("No text found in image", 404);
    }

    return {
      extractedText: ocrResponse.data.extractedText
    };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || "Failed to extract text from image", 500);
  }
}

router.get("/api/tools/ocr", asyncHandler(async (req, res) => {
  const { url, image, img } = req.query;
  const imageUrl = url || image || img;

  const validation = validate.fields({ url: imageUrl }, {
    url: { required: true, type: "url" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await ocrImage(imageUrl.trim());

  sendSuccessResponse(res, {
    source_url: imageUrl,
    ...result
  });
}));

router.post("/api/tools/ocr", asyncHandler(async (req, res) => {
  const { url, image, img } = req.body;
  const imageUrl = url || image || img;

  const validation = validate.fields({ url: imageUrl }, {
    url: { required: true, type: "url" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await ocrImage(imageUrl.trim());

  sendSuccessResponse(res, {
    source_url: imageUrl,
    ...result
  });
}));

router.metadata = {
  name: "OCR Image",
  path: "/api/tools/ocr",
  methods: ['GET', 'POST'],
  category: "TOOLS",
  description: "Extract text from images using OCR (Optical Character Recognition). Supports JPG, PNG and other image formats.",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://example.com/image-with-text.jpg",
      description: "Image URL containing text (also accepts: image, img)",
    },
  ],
};

module.exports = router;