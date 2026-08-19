'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

const CONFIG = {
  languages: ['EN-US', 'ES', 'ZH', 'PT-BR', 'NL', 'FI', 'FR', 'DE', 'EL', 'IT', 'PL', 'PT-PT', 'RO', 'RU', 'SK', 'SL', 'SV'],
  levels: ['standard', 'enhanced', 'aggressive']
};

async function unaimMyText(text, language = 'EN-US', level = 'standard') {
  try {

    if (!CONFIG.languages.includes(language)) {
      throw new ValidationError(
        `Invalid language. Available: ${CONFIG.languages.join(', ')}`,
        400
      );
    }

    if (!CONFIG.levels.includes(level)) {
      throw new ValidationError(
        `Invalid level. Available: ${CONFIG.levels.join(', ')}`,
        400
      );
    }

    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount > 1000) {
      throw new ValidationError('Maximum 1000 words allowed', 400);
    }

    const { data } = await axios.post(
      'https://unaimytext.com/api/humanize',
      {
        text: text,
        model: level,
        language: language
      },
      {
        headers: {
          origin: 'https://unaimytext.com',
          referer: 'https://unaimytext.com/',
          'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
        },
        timeout: 60000
      }
    );

    if (!data?.humanized_text) {
      throw new ValidationError('No humanized text received', 500);
    }

    return data.humanized_text;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    if (error.response) {
      throw new ValidationError(
        `Unaim API error: ${error.response.data?.message || error.response.statusText}`,
        error.response.status
      );
    }
    throw new ValidationError(error.message || 'Failed to humanize text', 500);
  }
}

router.get("/api/tools/unaimytext", asyncHandler(async (req, res) => {
  const { text, content, input, language, lang, level, mode } = req.query;
  const textContent = text || content || input;
  const selectedLanguage = (language || lang || 'EN-US').toUpperCase();
  const selectedLevel = level || mode || 'standard';

  const validation = validate.fields({ text: textContent }, {
    text: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  if (textContent.length < 50) {
    throw new ValidationError('Text must be at least 50 characters long', 400);
  }

  const humanizedText = await unaimMyText(textContent, selectedLanguage, selectedLevel);

  const originalWords = textContent.trim().split(/\s+/).length;
  const humanizedWords = humanizedText.trim().split(/\s+/).length;

  sendSuccessResponse(res, {
    original_text: textContent,
    humanized_text: humanizedText,
    language: selectedLanguage,
    level: selectedLevel,
    statistics: {
      original_length: textContent.length,
      humanized_length: humanizedText.length,
      original_words: originalWords,
      humanized_words: humanizedWords,
      difference_percentage: Math.round(((humanizedText.length - textContent.length) / textContent.length) * 100)
    }
  });
}));

router.post("/api/tools/unaimytext", asyncHandler(async (req, res) => {
  const { text, content, input, language, lang, level, mode } = req.body;
  const textContent = text || content || input;
  const selectedLanguage = (language || lang || 'EN-US').toUpperCase();
  const selectedLevel = level || mode || 'standard';

  const validation = validate.fields({ text: textContent }, {
    text: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  if (textContent.length < 50) {
    throw new ValidationError('Text must be at least 50 characters long', 400);
  }

  const humanizedText = await unaimMyText(textContent, selectedLanguage, selectedLevel);

  const originalWords = textContent.trim().split(/\s+/).length;
  const humanizedWords = humanizedText.trim().split(/\s+/).length;

  sendSuccessResponse(res, {
    original_text: textContent,
    humanized_text: humanizedText,
    language: selectedLanguage,
    level: selectedLevel,
    statistics: {
      original_length: textContent.length,
      humanized_length: humanizedText.length,
      original_words: originalWords,
      humanized_words: humanizedWords,
      difference_percentage: Math.round(((humanizedText.length - textContent.length) / textContent.length) * 100)
    }
  });
}));

router.metadata = {
  name: "Unaim My Text (AI Humanizer)",
  path: "/api/tools/unaimytext",
  methods: ['GET', 'POST'],
  category: "TOOLS",
  description: `Humanize AI-generated text with multiple levels and languages. Supports 17 languages and 3 humanization levels (standard, enhanced, aggressive). Maximum 1000 words. Languages: ${CONFIG.languages.join(', ')}`,
  params: [
    {
      name: "text",
      type: "text",
      required: true,
      placeholder: "The old lighthouse stood sentinel on the rugged cliff...",
      description: "Text to humanize (50-1000 words, also accepts: content, input)",
    },
    {
      name: "language",
      type: "text",
      required: false,
      placeholder: "EN-US",
      description: `Language code. Available: ${CONFIG.languages.join(', ')}. Default: EN-US (also accepts: lang)`,
      default: "EN-US",
      options: CONFIG.languages.map(function(l) { return { value: l, label: l }; }),
    },
    {
      name: "level",
      type: "text",
      required: false,
      placeholder: "standard",
      description: `Humanization level: ${CONFIG.levels.join(', ')}. Default: standard (also accepts: mode)`,
      default: "standard",
      options: [
        { value: "standard",   label: "standard — Natural rewrite" },
        { value: "enhanced",   label: "enhanced — More human-like" },
        { value: "aggressive", label: "aggressive — Maximum humanization" },
      ],
    },
  ],
};

module.exports = router;