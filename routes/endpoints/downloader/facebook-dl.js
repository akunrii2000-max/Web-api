'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function downloadFacebook(url) {
  try {
    if (!/facebook\.com/.test(url)) {
      throw new ValidationError('Invalid Facebook URL', 400);
    }

    const response = await axios.post(
      'https://likeedownloader.com/process',
      new URLSearchParams({ id: url, locale: 'en' }),
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10)',
          'Accept': 'application/json,text/javascript,*/*',
          'x-requested-with': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded',
          origin: 'https://likeedownloader.com',
          referer: 'https://likeedownloader.com/facebook-video-downloader'
        },
        timeout: 30000
      }
    );

    if (!response?.data?.template) {
      throw new ValidationError('Failed to fetch video data', 500);
    }

    const template = response.data.template;

    const thumbMatch = template.match(/<img[^>]+src="([^"]+)"/);
    const thumb = thumbMatch ? thumbMatch[1] : null;

    const links = [];
    for (const match of template.matchAll(/href="([^"]+)"[^>]*download/g)) {
      links.push(match[1]);
    }

    return {
      thumbnail: thumb,
      sd: links[0] || null,
      hd: links[1] || null
    };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || 'Failed to download Facebook video', 500);
  }
}

router.get("/api/download/facebook", asyncHandler(async (req, res) => {
  const { url, link } = req.query;
  const fbUrl = url || link;

  const validation = validate.fields({ url: fbUrl }, {
    url: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await downloadFacebook(fbUrl);

  sendSuccessResponse(res, {
    source_url: fbUrl,
    ...result
  });
}));

router.post("/api/download/facebook", asyncHandler(async (req, res) => {
  const { url, link } = req.body;
  const fbUrl = url || link;

  const validation = validate.fields({ url: fbUrl }, {
    url: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await downloadFacebook(fbUrl);

  sendSuccessResponse(res, {
    source_url: fbUrl,
    ...result
  });
}));

router.metadata = {
  name: "Facebook Video Download",
  path: "/api/download/facebook",
  methods: ['GET', 'POST'],
  category: "DOWNLOADER",
  description: "Download videos from Facebook. Supports regular posts, reels, and watch videos. Returns SD and HD quality download links along with thumbnail.",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://www.facebook.com/reel/1173026878305572/",
      description: "Facebook video URL (also accepts: link)",
    },
  ],
};

module.exports = router;