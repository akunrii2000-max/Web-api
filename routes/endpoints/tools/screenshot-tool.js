'use strict';

const { Router } = require('express');
const axios = require('axios');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function takeScreenshot(url) {
  if (!validate.url(url)) {
    throw new ValidationError("Invalid URL", 400);
  }

  try {
    const accessKey = "fdaf638490cf4d5aad5bdabe7ec23187";
    const params = new URLSearchParams({
      access_key: accessKey,
      url: url,
      response_type: "image",
      full_page: "true"
    });

    const { data } = await axios.get(`https://api.apiflash.com/v1/urltoimage?${params}`, {
      responseType: "arraybuffer",
      timeout: 60000
    });

    return Buffer.from(data);
  } catch (error) {
    throw new ValidationError(error.message || "Failed to take screenshot", 500);
  }
}

router.get("/api/tools/screenshot", asyncHandler(async (req, res) => {
  const { url, link, website } = req.query;
  const targetUrl = url || link || website;

  const validation = validate.fields({ url: targetUrl }, {
    url: { required: true, type: "url" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const imageBuffer = await takeScreenshot(targetUrl.trim());

  res.set("Content-Type", "image/jpeg");
  res.set("Content-Length", imageBuffer.length.toString());
  res.set("Cache-Control", "public, max-age=3600");
  res.set("Content-Disposition", `inline; filename="screenshot_${Date.now()}.jpg"`);
  res.set("X-Source-URL", targetUrl);
  res.send(imageBuffer);
}));

router.post("/api/tools/screenshot", asyncHandler(async (req, res) => {
  const { url, link, website } = req.body;
  const targetUrl = url || link || website;

  const validation = validate.fields({ url: targetUrl }, {
    url: { required: true, type: "url" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const imageBuffer = await takeScreenshot(targetUrl.trim());

  res.set("Content-Type", "image/jpeg");
  res.set("Content-Length", imageBuffer.length.toString());
  res.set("Cache-Control", "public, max-age=3600");
  res.set("Content-Disposition", `inline; filename="screenshot_${Date.now()}.jpg"`);
  res.set("X-Source-URL", targetUrl);
  res.send(imageBuffer);
}));

router.metadata = {
  name: "Website Screenshot",
  path: "/api/tools/screenshot",
  methods: ['GET', 'POST'],
  category: "TOOLS",
  description: "Take full-page screenshot of any website. Returns image directly as JPEG.",
  responseBinary: true,
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://example.com",
      description: "Website URL to screenshot (also accepts: link, website)",
    },
  ],
};

module.exports = router;