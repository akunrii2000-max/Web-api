'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function downloadInstagram(url) {
  try {
    if (!/instagram\.com/.test(url)) {
      throw new ValidationError('Invalid Instagram URL', 400);
    }

    const encoded = encodeURIComponent(url);
    const { data: json } = await axios.get(
      `https://igram.website/content.php?url=${encoded}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; Termux)"
        },
        timeout: 30000
      }
    );

    if (!json.html) {
      throw new ValidationError('Failed to fetch Instagram data', 500);
    }

    const $ = cheerio.load(json.html);

    return {
      user: json.username || "unknown",
      thumbnail: $("img.w-100").attr("src") || null,
      caption: $("p.text-sm").text().trim() || null,
      download: $('a:contains("Download HD")').attr("href") || null
    };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || 'Failed to download Instagram content', 500);
  }
}

router.get("/api/download/instagram", asyncHandler(async (req, res) => {
  const { url, link } = req.query;
  const igUrl = url || link;

  const validation = validate.fields({ url: igUrl }, {
    url: { required: true, type: "url", domain: "instagram.com" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await downloadInstagram(igUrl);

  sendSuccessResponse(res, {
    source_url: igUrl,
    ...data
  });
}));

router.post("/api/download/instagram", asyncHandler(async (req, res) => {
  const { url, link } = req.body;
  const igUrl = url || link;

  const validation = validate.fields({ url: igUrl }, {
    url: { required: true, type: "url", domain: "instagram.com" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await downloadInstagram(igUrl);

  sendSuccessResponse(res, {
    source_url: igUrl,
    ...data
  });
}));

router.metadata = {
  name: "Instagram Download",
  path: "/api/download/instagram",
  methods: ['GET', 'POST'],
  category: "DOWNLOADER",
  description: "Download Instagram photos and videos. Returns download link, thumbnail, caption, and user info.",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://www.instagram.com/p/xxxxx/",
      description: "Instagram post URL (also accepts: link)",
    },
  ],
};

module.exports = router;