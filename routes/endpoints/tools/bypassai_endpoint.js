'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function bypassAI(text) {
  try {
    const { data } = await axios.get(
      'https://31jnx1hcnk.execute-api.us-east-1.amazonaws.com/default/test_7_aug_24',
      {
        headers: {
          origin: 'https://bypassai.writecream.com',
          referer: 'https://bypassai.writecream.com/',
          'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
        },
        params: {
          content: text
        },
        timeout: 60000
      }
    );

    if (!data?.finalContent) {
      throw new ValidationError('No humanized content received', 500);
    }

    const cleanedText = data.finalContent.replace(/<span[^>]*>|<\/span>/g, '');

    return cleanedText;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    if (error.response) {
      throw new ValidationError(
        `Bypass AI API error: ${error.response.data?.message || error.response.statusText}`,
        error.response.status
      );
    }
    throw new ValidationError(error.message || 'Failed to bypass AI detection', 500);
  }
}

router.get("/api/tools/bypassai", asyncHandler(async (req, res) => {
  const { text, content, input } = req.query;
  const textContent = text || content || input;

  const validation = validate.fields({ text: textContent }, {
    text: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  if (textContent.length < 50) {
    throw new ValidationError('Text must be at least 50 characters long', 400);
  }

  const humanizedText = await bypassAI(textContent);

  sendSuccessResponse(res, {
    original_length: textContent.length,
    humanized_length: humanizedText.length,
    original_text: textContent,
    humanized_text: humanizedText
  });
}));

router.post("/api/tools/bypassai", asyncHandler(async (req, res) => {
  const { text, content, input } = req.body;
  const textContent = text || content || input;

  const validation = validate.fields({ text: textContent }, {
    text: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  if (textContent.length < 50) {
    throw new ValidationError('Text must be at least 50 characters long', 400);
  }

  const humanizedText = await bypassAI(textContent);

  sendSuccessResponse(res, {
    original_length: textContent.length,
    humanized_length: humanizedText.length,
    original_text: textContent,
    humanized_text: humanizedText
  });
}));

router.metadata = {
  name: "Bypass AI Detector",
  path: "/api/tools/bypassai",
  methods: ['GET', 'POST'],
  category: "TOOLS",
  description: "Humanize AI-generated text to bypass AI detection tools. Rewrite AI content to make it appear human-written. Powered by Writecream. Minimum 50 characters required.",
  params: [
    {
      name: "text",
      type: "text",
      required: true,
      placeholder: "The old lighthouse stood sentinel on the rugged cliff...",
      description: "AI-generated text to humanize (minimum 50 characters, also accepts: content, input)",
    },
  ],
};

module.exports = router;