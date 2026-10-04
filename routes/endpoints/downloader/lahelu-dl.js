'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function downloadLahelu(url) {
  try {
    if (!/lahelu\.com/.test(url)) {
      throw new ValidationError('Invalid Lahelu URL', 400);
    }

    const postID = url.replace("https://lahelu.com/post/", "").split("/")[0].split("?")[0];

    if (!postID) {
      throw new ValidationError('Post ID not found in URL', 400);
    }

    const { data } = await axios.get("https://lahelu.com/api/post/get", {
      params: { postID },
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      timeout: 30000
    });

    if (!data?.postInfo) {
      throw new ValidationError('Post not found or unavailable', 404);
    }

    const {
      postID: id,
      userID,
      title,
      media,
      sensitive,
      hashtags,
      createTime,
      totalComments,
      totalLikes
    } = data.postInfo;

    const formattedCreateTime = createTime
      ? new Date(createTime * 1000).toISOString()
      : null;

    return {
      postId: id,
      userId: userID,
      title: title || null,
      media: media || [],
      sensitive: sensitive || false,
      hashtags: hashtags || [],
      createTime: formattedCreateTime,
      totalComments: totalComments || 0,
      totalLikes: totalLikes || 0
    };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    if (error.response?.status === 404) {
      throw new ValidationError('Post not found', 404);
    }
    throw new ValidationError(error.message || 'Failed to download from Lahelu', 500);
  }
}

router.get("/api/download/lahelu", asyncHandler(async (req, res) => {
  const { url, link } = req.query;
  const laheluUrl = url || link;

  const validation = validate.fields({ url: laheluUrl }, {
    url: { required: true, type: "url", domain: "lahelu.com" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await downloadLahelu(laheluUrl.trim());

  sendSuccessResponse(res, {
    source_url: laheluUrl,
    ...data
  });
}));

router.post("/api/download/lahelu", asyncHandler(async (req, res) => {
  const { url, link } = req.body;
  const laheluUrl = url || link;

  const validation = validate.fields({ url: laheluUrl }, {
    url: { required: true, type: "url", domain: "lahelu.com" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await downloadLahelu(laheluUrl.trim());

  sendSuccessResponse(res, {
    source_url: laheluUrl,
    ...data
  });
}));

router.metadata = {
  name: "Lahelu Download",
  path: "/api/download/lahelu",
  methods: ['GET', 'POST'],
  category: "DOWNLOADER",
  description: "Download posts from Lahelu.com (Indonesian meme platform). Returns post info, media, hashtags, and engagement stats.",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://lahelu.com/post/abc123",
      description: "Lahelu post URL (also accepts: link)",
    },
  ],
};

module.exports = router;