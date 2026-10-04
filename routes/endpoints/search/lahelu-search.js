'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

const formatPostInfo = (postInfo) => ({
  ...postInfo,
  postID: `https://lahelu.com/post/${postInfo.postID}`,
  media: postInfo.media,
  mediaThumbnail: postInfo.mediaThumbnail ? `https://cache.lahelu.com/${postInfo.mediaThumbnail}` : null,
  userUsername: `https://lahelu.com/user/${postInfo.userUsername}`,
  userAvatar: `https://cache.lahelu.com/${postInfo.userAvatar}`,
  createTime: new Date(postInfo.createTime).toISOString(),
});

async function searchLahelu(query) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Referer: "https://lahelu.com",
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "application/json, text/plain, */*",
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        DNT: "1",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        TE: "Trailers",
        Host: "lahelu.com",
        Origin: "https://lahelu.com",
        "X-Requested-With": "XMLHttpRequest",
      },
      timeout: 30000,
    };

    const response = await axios.get(
      `https://lahelu.com/api/post/get-search?query=${encodedQuery}`,
      options
    );

    if (response.status === 200 && response.data && response.data.postInfos) {
      return response.data.postInfos.map(formatPostInfo);
    } else {
      throw new ValidationError(`Request failed with status code ${response.status || "unknown"}`, 500);
    }
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || "Failed to search posts on Lahelu.com", 500);
  }
}

router.get("/api/search/lahelu", asyncHandler(async (req, res) => {
  const { query, q, search } = req.query;
  const searchQuery = query || q || search;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await searchLahelu(searchQuery.trim());

  sendSuccessResponse(res, {
    query: searchQuery,
    total: result.length,
    posts: result
  });
}));

router.post("/api/search/lahelu", asyncHandler(async (req, res) => {
  const { query, q, search } = req.body;
  const searchQuery = query || q || search;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await searchLahelu(searchQuery.trim());

  sendSuccessResponse(res, {
    query: searchQuery,
    total: result.length,
    posts: result
  });
}));

router.metadata = {
  name: "Lahelu Posts Search",
  path: "/api/search/lahelu",
  methods: ['GET', 'POST'],
  category: "SEARCH",
  description: "Search for posts on Lahelu.com social media platform. Returns posts with media, thumbnails, user info, and timestamps.",
  params: [
    {
      name: "query",
      type: "text",
      required: true,
      placeholder: "drak",
      description: "Search query for Lahelu posts (also accepts: q, search)",
    },
  ],
};

module.exports = router;