'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function ssstik(url) {
  try {
    if (!/tiktok\.com|vt\.tiktok\.com/.test(url)) {
      throw new ValidationError('Invalid TikTok URL', 400);
    }

    const { data: html } = await axios.post(
      "https://ssstik.io/abc?url=dl",
      new URLSearchParams({
        id: url,
        locale: "en",
        tt: "Taka Aja Ya Ges Yak",
        debug: "ab=0&loc=ID&ip=1.1.1.1.1"
      }).toString(),
      {
        headers: {
          "HX-Request": "true",
          "HX-Trigger": "_gcaptcha_pt",
          "HX-Target": "target",
          "HX-Current-URL": "https://ssstik.io/en-1",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36",
          "Referer": "https://ssstik.io/en-1"
        },
        timeout: 30000
      }
    );

    const $ = cheerio.load(html);

    const images = [];
    $("img[data-splide-lazy]").each((i, el) => {
      const u = $(el).attr("data-splide-lazy");
      if (u) images.push(u);
    });

    const mp3 = $("a.music").attr("href") || null;
    const author = $("h2").first().text().trim() || null;
    const author_avatar = $("img.result_author").attr("src") || null;
    const likes = $("#trending-actions div:nth-child(1) div:nth-child(2)").text().trim() || null;
    const comments = $("#trending-actions div:nth-child(2) div:nth-child(2)").text().trim() || null;
    const shares = $("#trending-actions div:nth-child(3) div:nth-child(2)").text().trim() || null;

    if (images.length > 0) {
      return {
        type: "image",
        author,
        author_avatar,
        mp3,
        images,
        stats: {
          likes,
          comments,
          shares
        }
      };
    }

    const video_hd = $("#hd_download").attr("data-directurl") || null;
    const video_nowm = $("a.without_watermark").attr("href") || null;

    if (!video_hd && !video_nowm) {
      throw new ValidationError('Failed to extract video URLs', 500);
    }

    return {
      type: "video",
      author,
      author_avatar,
      mp3,
      video: {
        hd: video_hd,
        no_watermark: video_nowm
      },
      stats: {
        likes,
        comments,
        shares
      }
    };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || 'Failed to download TikTok content', 500);
  }
}

router.get("/api/download/tiktok", asyncHandler(async (req, res) => {
  const { url, link } = req.query;
  const tiktokUrl = url || link;

  const validation = validate.fields({ url: tiktokUrl }, {
    url: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await ssstik(tiktokUrl);

  sendSuccessResponse(res, {
    source_url: tiktokUrl,
    ...data
  });
}));

router.post("/api/download/tiktok", asyncHandler(async (req, res) => {
  const { url, link } = req.body;
  const tiktokUrl = url || link;

  const validation = validate.fields({ url: tiktokUrl }, {
    url: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await ssstik(tiktokUrl);

  sendSuccessResponse(res, {
    source_url: tiktokUrl,
    ...data
  });
}));

router.metadata = {
  name: "TikTok Download (SUPPORT ALL)",
  path: "/api/download/tiktok",
  methods: ['GET', 'POST'],
  category: "DOWNLOADER",
  description: "Download TikTok videos and images. Supports both video posts (HD, no watermark) and slideshow/image posts. Returns video/images, audio, author info, and engagement stats.",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://vt.tiktok.com/xxx/",
      description: "TikTok video URL (supports short links, also accepts: link)",
    },
  ],
};

module.exports = router;