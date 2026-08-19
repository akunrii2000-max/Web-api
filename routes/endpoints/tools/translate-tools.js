'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function translateText(text, source = "auto", target = "id") {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;

    const response = await axios.get(url, {
      timeout: 30000,
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const fragments = response.data?.[0];
    const translated = Array.isArray(fragments)
      ? fragments.map(item => item?.[0] || '').filter(Boolean).join('')
      : null;

    if (!translated) {
      throw new ValidationError("Translation failed", 500);
    }

    return {
      original: text,
      translated: translated,
      source_language: source,
      target_language: target
    };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || "Failed to translate text", 500);
  }
}

router.get("/api/tools/translate", asyncHandler(async (req, res) => {
  const { text, source = "auto", target = "id" } = req.query;

  const validation = validate.fields({ text }, {
    text: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await translateText(text.trim(), source, target);
  sendSuccessResponse(res, result);
}));

router.post("/api/tools/translate", asyncHandler(async (req, res) => {
  const { text, source = "auto", target = "id" } = req.body;

  const validation = validate.fields({ text }, {
    text: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await translateText(text.trim(), source, target);
  sendSuccessResponse(res, result);
}));

router.metadata = {
  name: "Translate Text",
  path: "/api/tools/translate",
  methods: ['GET', 'POST'],
  category: "TOOLS",
  description: "Translate text between languages using Google Translate API. Supports auto-detection of source language.",
  params: [
    {
      name: "text",
      type: "text",
      required: true,
      placeholder: "I love you",
      description: "Text to translate",
    },
    {
      name: "source",
      type: "text",
      required: false,
      placeholder: "auto",
      description: "Source language code (default: auto)",
      default: "auto",
      options: [
        { value: "auto", label: "🔍 Auto detect" },
        { value: "id", label: "🇮🇩 Indonesian" },
        { value: "en", label: "🇺🇸 English" },
        { value: "ja", label: "🇯🇵 Japanese" },
        { value: "ko", label: "🇰🇷 Korean" },
        { value: "zh-CN", label: "🇨🇳 Chinese (Simplified)" },
        { value: "zh-TW", label: "🇹🇼 Chinese (Traditional)" },
        { value: "ar", label: "🇸🇦 Arabic" },
        { value: "fr", label: "🇫🇷 French" },
        { value: "de", label: "🇩🇪 German" },
        { value: "es", label: "🇪🇸 Spanish" },
        { value: "pt", label: "🇵🇹 Portuguese" },
        { value: "ru", label: "🇷🇺 Russian" },
        { value: "hi", label: "🇮🇳 Hindi" },
        { value: "th", label: "🇹🇭 Thai" },
        { value: "vi", label: "🇻🇳 Vietnamese" },
        { value: "tr", label: "🇹🇷 Turkish" },
        { value: "nl", label: "🇳🇱 Dutch" },
        { value: "sv", label: "🇸🇪 Swedish" },
        { value: "pl", label: "🇵🇱 Polish" },
        { value: "it", label: "🇮🇹 Italian" },
      ],
    },
    {
      name: "target",
      type: "text",
      required: false,
      placeholder: "id",
      description: "Target language code (default: id)",
      default: "id",
      options: [
        { value: "id", label: "🇮🇩 Indonesian" },
        { value: "en", label: "🇺🇸 English" },
        { value: "ja", label: "🇯🇵 Japanese" },
        { value: "ko", label: "🇰🇷 Korean" },
        { value: "zh-CN", label: "🇨🇳 Chinese (Simplified)" },
        { value: "zh-TW", label: "🇹🇼 Chinese (Traditional)" },
        { value: "ar", label: "🇸🇦 Arabic" },
        { value: "fr", label: "🇫🇷 French" },
        { value: "de", label: "🇩🇪 German" },
        { value: "es", label: "🇪🇸 Spanish" },
        { value: "pt", label: "🇵🇹 Portuguese" },
        { value: "ru", label: "🇷🇺 Russian" },
        { value: "hi", label: "🇮🇳 Hindi" },
        { value: "th", label: "🇹🇭 Thai" },
        { value: "vi", label: "🇻🇳 Vietnamese" },
        { value: "tr", label: "🇹🇷 Turkish" },
        { value: "nl", label: "🇳🇱 Dutch" },
        { value: "sv", label: "🇸🇪 Swedish" },
        { value: "pl", label: "🇵🇱 Polish" },
        { value: "it", label: "🇮🇹 Italian" },
      ],
    },
  ],
};

module.exports = router;