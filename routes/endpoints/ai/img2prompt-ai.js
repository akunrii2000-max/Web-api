'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

const CONFIG = {
  languages: ['en', 'es', 'zh', 'zh-TW', 'fr', 'de', 'ja', 'ru', 'pt', 'ar', 'ko', 'it', 'nl', 'tr', 'pl', 'vi', 'th', 'hi', 'id'],
  models: ['general', 'midjourney', 'dalle', 'stable_diffusion', 'flux']
};

async function downloadImage(imageUrl) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    return Buffer.from(response.data);
  } catch (error) {
    throw new ValidationError('Failed to download image. Please check the URL.', 400);
  }
}

async function img2prompt(imageBuffer, { language = 'en', model = 'general' } = {}) {
  try {

    if (!CONFIG.languages.includes(language)) {
      throw new ValidationError(
        `Invalid language. Available: ${CONFIG.languages.join(', ')}`,
        400
      );
    }

    if (!CONFIG.models.includes(model)) {
      throw new ValidationError(
        `Invalid model. Available: ${CONFIG.models.join(', ')}`,
        400
      );
    }

    const base64Image = imageBuffer.toString('base64');

    const { data } = await axios.post(
      'https://api.imagepromptguru.net/image-to-prompt',
      {
        image: `data:image/jpeg;base64,${base64Image}`,
        language: language,
        model: model
      },
      {
        headers: {
          origin: 'https://imagepromptguru.net',
          referer: 'https://imagepromptguru.net/',
          'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
        },
        timeout: 60000
      }
    );

    if (!data.prompt) {
      throw new ValidationError('No prompt generated from the image', 500);
    }

    return data.prompt;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    if (error.response) {
      throw new ValidationError(
        `API error: ${error.response.data?.message || error.response.statusText}`,
        error.response.status
      );
    }
    throw new ValidationError(error.message || 'Failed to generate prompt from image', 500);
  }
}

router.get("/api/ai/img2prompt", asyncHandler(async (req, res) => {
  const { url, image, img, language, lang, model } = req.query;
  const imageUrl = url || image || img;
  const selectedLanguage = language || lang || 'en';
  const selectedModel = model || 'general';

  const validation = validate.fields({ imageUrl }, {
    imageUrl: { required: true, type: "url" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const imageBuffer = await downloadImage(imageUrl);

  const prompt = await img2prompt(imageBuffer, {
    language: selectedLanguage,
    model: selectedModel
  });

  sendSuccessResponse(res, {
    image_url: imageUrl,
    language: selectedLanguage,
    model: selectedModel,
    prompt: prompt
  });
}));

router.post("/api/ai/img2prompt", asyncHandler(async (req, res) => {
  const { url, image, img, language, lang, model } = req.body;
  const imageUrl = url || image || img;
  const selectedLanguage = language || lang || 'en';
  const selectedModel = model || 'general';

  const validation = validate.fields({ imageUrl }, {
    imageUrl: { required: true, type: "url" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const imageBuffer = await downloadImage(imageUrl);

  const prompt = await img2prompt(imageBuffer, {
    language: selectedLanguage,
    model: selectedModel
  });

  sendSuccessResponse(res, {
    image_url: imageUrl,
    language: selectedLanguage,
    model: selectedModel,
    prompt: prompt
  });
}));

router.metadata = {
  name: "Image to Prompt (AI)",
  path: "/api/ai/img2prompt",
  methods: ['GET', 'POST'],
  category: "AI",
  description: "Generate AI prompt from image using ImagePromptGuru. Supports multiple languages and AI models (Midjourney, DALL-E, Stable Diffusion, Flux). Provide image URL to get detailed prompt description.",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://example.com/image.jpg",
      description: "Image URL (also accepts: image, img)",
    },
    {
      name: "language",
      type: "text",
      required: false,
      placeholder: "en",
      description: `Language for prompt. Available: ${CONFIG.languages.join(', ')}. Default: en (also accepts: lang)`,
    },
    {
      name: "model",
      type: "text",
      required: false,
      placeholder: "general",
      description: `AI model style. Available: ${CONFIG.models.join(', ')}. Default: general`,
    },
  ],
};

module.exports = router;