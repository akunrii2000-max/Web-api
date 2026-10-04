'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function submitNGL(question, urlString) {
  try {
    if (!validate.notEmpty(question)) {
      throw new ValidationError("Message is required", 400);
    }

    if (!validate.url(urlString)) {
      throw new ValidationError("Invalid NGL URL", 400);
    }

    const parsedUrl = new URL(urlString);
    const username = parsedUrl.pathname.split("/").filter(Boolean).pop();

    if (!username) {
      throw new ValidationError("Unable to extract username from URL", 400);
    }

    const postData = new URLSearchParams({
      username,
      question: question.trim(),
      deviceId: "",
      gameSlug: "",
      referrer: ""
    });

    const { data } = await axios.post(
      "https://ngl.link/api/submit",
      postData.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "*/*",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": urlString
        },
        timeout: 30000
      }
    );

    return data;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    if (error.response) {
      throw new ValidationError(
        error.response.data?.message || error.response.statusText || "Request failed",
        error.response.status
      );
    }
    throw new ValidationError(error.message || 'Failed to send NGL message', 500);
  }
}

router.get("/api/tools/ngl", asyncHandler(async (req, res) => {
  const { link, text, message } = req.query;
  const nglUrl = link;
  const nglMessage = text || message;

  if (!validate.notEmpty(nglUrl)) {
    throw new ValidationError("Link parameter is required", 400);
  }

  if (!validate.notEmpty(nglMessage)) {
    throw new ValidationError("Text/message parameter is required", 400);
  }

  const result = await submitNGL(nglMessage, nglUrl);

  sendSuccessResponse(res, {
    link: nglUrl,
    message: nglMessage,
    result: result,
    timestamp: new Date().toISOString()
  });
}));

router.post("/api/tools/ngl", asyncHandler(async (req, res) => {
  const { link, text, message } = req.body;
  const nglUrl = link;
  const nglMessage = text || message;

  if (!validate.notEmpty(nglUrl)) {
    throw new ValidationError("Link parameter is required", 400);
  }

  if (!validate.notEmpty(nglMessage)) {
    throw new ValidationError("Text/message parameter is required", 400);
  }

  const result = await submitNGL(nglMessage, nglUrl);

  sendSuccessResponse(res, {
    link: nglUrl,
    message: nglMessage,
    result: result,
    timestamp: new Date().toISOString()
  });
}));

router.metadata = {
  name: "NGL Message Sender",
  path: "/api/tools/ngl",
  methods: ['GET', 'POST'],
  category: "TOOLS",
  description: "Send anonymous message to NGL.link profile. Messages are delivered anonymously to the recipient.",
  params: [
    {
      name: "link",
      type: "text",
      required: true,
      placeholder: "https://ngl.link/username",
      description: "NGL.link profile URL",
    },
    {
      name: "text",
      type: "text",
      required: true,
      placeholder: "Hello!",
      description: "Message to send (also accepts: message)",
    },
  ],
};

module.exports = router;