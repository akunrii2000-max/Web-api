'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function douyinDl(url) {
  try {
    if (!/douyin\.com/.test(url)) {
      throw new ValidationError('Invalid Douyin URL', 400);
    }

    const { data } = await axios.post(
      "https://snapdouyin.app/wp-json/mx-downloader/video-data/",
      { url },
      {
        headers: {
          "content-type": "application/json",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "origin": "https://snapdouyin.app",
          "referer": "https://snapdouyin.app/"
        },
        timeout: 30000
      }
    );

    if (!data) {
      throw new ValidationError('Failed to fetch Douyin data', 500);
    }

    return data;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    if (error.response) {
      throw new ValidationError(
        `SnapDouyin API error: ${error.response.data?.message || error.response.statusText}`,
        error.response.status
      );
    }
    throw new ValidationError(error.message || 'Failed to download Douyin video', 500);
  }
}

router.get("/api/download/douyin", asyncHandler(async (req, res) => {
  const { url, link } = req.query;
  const douyinUrl = url || link;

  const validation = validate.fields({ url: douyinUrl }, {
    url: { required: true, type: "url", domain: "douyin.com" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await douyinDl(douyinUrl);

  sendSuccessResponse(res, {
    source_url: douyinUrl,
    ...data
  });
}));

router.post("/api/download/douyin", asyncHandler(async (req, res) => {
  const { url, link } = req.body;
  const douyinUrl = url || link;

  const validation = validate.fields({ url: douyinUrl }, {
    url: { required: true, type: "url", domain: "douyin.com" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await douyinDl(douyinUrl);

  sendSuccessResponse(res, {
    source_url: douyinUrl,
    ...data
  });
}));

router.metadata = {
  name: "Douyin Download",
  path: "/api/download/douyin",
  methods: ['GET', 'POST'],
  category: "DOWNLOADER",
  description: "Download videos from Douyin (Chinese TikTok) using SnapDouyin API. Returns video download links, thumbnail, and video information.",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://v.douyin.com/H8URhVEAnD4/",
      description: "Douyin video URL (also accepts: link)",
    },
  ],
};

module.exports = router;