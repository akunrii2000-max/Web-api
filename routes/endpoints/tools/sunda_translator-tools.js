'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function translateToSunda(text) {
  try {
    if (!validate.notEmpty(text)) {
      throw new ValidationError("Text is required", 400);
    }

    const body = new URLSearchParams({
      from_lang: "id_ID",
      to: "su_ID",
      text: text.trim(),
      platform: "dp"
    }).toString();

    const headers = {
      Host: "lingvanex.com",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0",
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "id,en-US;q=0.7,en;q=0.3",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Origin: "https://lingvanex.com",
      Referer: "https://lingvanex.com/translation/indonesia-ke-bahasa-sunda",
      Connection: "keep-alive",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin"
    };

    const response = await axios.post(
      "https://lingvanex.com/translation/translate",
      body,
      {
        headers,
        timeout: 30000
      }
    );

    if (response.data.err) {
      throw new ValidationError("Translation failed: " + response.data.err, 500);
    }

    if (!response.data.result) {
      throw new ValidationError("Translation result not found", 500);
    }

    return response.data.result;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || 'Failed to translate text', 500);
  }
}

router.get("/api/tools/translate/sunda", asyncHandler(async (req, res) => {
  const { text } = req.query;

  const validation = validate.fields({ text }, {
    text: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await translateToSunda(text);

  sendSuccessResponse(res, {
    original: text.trim(),
    translated: result,
    sourceLang: "Indonesian",
    targetLang: "Sundanese",
    timestamp: new Date().toISOString()
  });
}));

router.post("/api/tools/translate/sunda", asyncHandler(async (req, res) => {
  const { text } = req.body;

  const validation = validate.fields({ text }, {
    text: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await translateToSunda(text);

  sendSuccessResponse(res, {
    original: text.trim(),
    translated: result,
    sourceLang: "Indonesian",
    targetLang: "Sundanese",
    timestamp: new Date().toISOString()
  });
}));

router.metadata = {
  name: "Translate to Sundanese",
  path: "/api/tools/translate/sunda",
  methods: ['GET', 'POST'],
  category: "TOOLS",
  description: "Translate Indonesian text to Sundanese using Lingvanex API. Returns original and translated text.",
  params: [
    {
      name: "text",
      type: "text",
      required: true,
      placeholder: "nama kamu siapa",
      description: "Indonesian text to translate to Sundanese",
    },
  ],
};

module.exports = router;