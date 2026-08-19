'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

class XiaohongshuDownloader {
  constructor() {
    this.client = axios.create({
      baseURL: "https://rednote-downloader.io",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://rednote-downloader.io/?ref=api"
      },
      timeout: 30000
    });
  }

  async download(url) {
    try {
      if (!url || !validate.url(url)) {
        throw new ValidationError("Invalid Xiaohongshu URL", 400);
      }

      const { data } = await this.client.post("/api/download", { url });

      if (!data) {
        throw new ValidationError("No media found", 404);
      }

      return data;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      if (error.response) {
        throw new ValidationError(
          `RedNote API error: ${error.response.data?.message || error.response.statusText}`,
          error.response.status
        );
      }
      throw new ValidationError(error.message || 'Failed to download from Xiaohongshu', 500);
    }
  }
}

const xhsDownloader = new XiaohongshuDownloader();

router.get("/api/download/xiaohongshu", asyncHandler(async (req, res) => {
  const { url, link } = req.query;
  const xhsUrl = url || link;

  if (!xhsUrl || !validate.url(xhsUrl)) {
    throw new ValidationError("Valid Xiaohongshu URL is required", 400);
  }

  const data = await xhsDownloader.download(xhsUrl.trim());

  sendSuccessResponse(res, {
    source_url: xhsUrl,
    ...data
  });
}));

router.post("/api/download/xiaohongshu", asyncHandler(async (req, res) => {
  const { url, link } = req.body;
  const xhsUrl = url || link;

  if (!xhsUrl || !validate.url(xhsUrl)) {
    throw new ValidationError("Valid Xiaohongshu URL is required", 400);
  }

  const data = await xhsDownloader.download(xhsUrl.trim());

  sendSuccessResponse(res, {
    source_url: xhsUrl,
    ...data
  });
}));

router.metadata = {
  name: "Xiaohongshu (RedNote) Download",
  path: "/api/download/xiaohongshu",
  methods: ['GET', 'POST'],
  category: "DOWNLOADER",
  description: "Download photos and videos from Xiaohongshu (Little Red Book / RedNote). Returns media URLs and post information.",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://www.xiaohongshu.com/explore/xxxxx",
      description: "Xiaohongshu post URL (also accepts: link)",
    },
  ],
};

module.exports = router;