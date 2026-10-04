'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function dailymotionDl(url) {
  try {
    if (!/dailymotion\.com/.test(url)) {
      throw new ValidationError('Invalid Dailymotion URL', 400);
    }

    const { data } = await axios.post(
      "https://vidomon.com/wp-json/aio-dl/video-data/",
      { url },
      {
        headers: {
          "content-type": "application/json",
          "origin": "https://vidomon.com",
          "referer": "https://vidomon.com/",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 30000
      }
    );

    if (!data) {
      throw new ValidationError('Failed to fetch Dailymotion data', 500);
    }

    return data;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    if (error.response) {
      throw new ValidationError(
        `Vidomon API error: ${error.response.data?.message || error.response.statusText}`,
        error.response.status
      );
    }
    throw new ValidationError(error.message || 'Failed to download Dailymotion video', 500);
  }
}

router.get("/api/download/dailymotion", asyncHandler(async (req, res) => {
  const { url, link } = req.query;
  const dmUrl = url || link;

  const validation = validate.fields({ url: dmUrl }, {
    url: { required: true, type: "url", domain: "dailymotion.com" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await dailymotionDl(dmUrl);

  sendSuccessResponse(res, {
    source_url: dmUrl,
    ...data
  });
}));

router.post("/api/download/dailymotion", asyncHandler(async (req, res) => {
  const { url, link } = req.body;
  const dmUrl = url || link;

  const validation = validate.fields({ url: dmUrl }, {
    url: { required: true, type: "url", domain: "dailymotion.com" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await dailymotionDl(dmUrl);

  sendSuccessResponse(res, {
    source_url: dmUrl,
    ...data
  });
}));

router.metadata = {
  name: "Dailymotion Download",
  path: "/api/download/dailymotion",
  methods: ['GET', 'POST'],
  category: "DOWNLOADER",
  description: "Download videos from Dailymotion using Vidomon API. Returns video download links with various quality options, thumbnail, and video information.",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://www.dailymotion.com/video/x9v4ejs",
      description: "Dailymotion video URL (also accepts: link)",
    },
  ],
};

module.exports = router;