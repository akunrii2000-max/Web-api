'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function checkGrammar(text) {
  try {

    const { data: submitResponse } = await axios.post(
      'https://app.essaypro.com/api/ai-tools/v1_0/grammar-checker/report/',
      {
        text: text,
        file: null
      },
      {
        headers: {
          origin: 'https://paperwriter.com',
          referer: 'https://paperwriter.com/grammar-checker',
          'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
        },
        timeout: 30000
      }
    );

    if (!submitResponse?.id) {
      throw new ValidationError('Failed to get analysis ID', 500);
    }

    const reportId = submitResponse.id;

    const maxAttempts = 120;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const { data: result } = await axios.get(
        `https://app.essaypro.com/api/ai-tools/v1_0/grammar-checker/report/${reportId}`,
        {
          headers: {
            origin: 'https://paperwriter.com',
            referer: 'https://paperwriter.com/grammar-checker',
            'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
          },
          timeout: 10000
        }
      );

      if (result?.status === 'completed') {
        return result;
      }

      if (result?.status === 'failed') {
        throw new ValidationError('Grammar check failed', 500);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new ValidationError('Grammar check timeout. Please try again.', 504);
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    if (error.response) {
      throw new ValidationError(
        `Grammar Checker API error: ${error.response.data?.message || error.response.statusText}`,
        error.response.status
      );
    }
    throw new ValidationError(error.message || 'Failed to check grammar', 500);
  }
}

router.get("/api/tools/grammarcheck", asyncHandler(async (req, res) => {
  const { text, content, input } = req.query;
  const textContent = text || content || input;

  const validation = validate.fields({ text: textContent }, {
    text: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  if (textContent.length < 10) {
    throw new ValidationError('Text must be at least 10 characters long', 400);
  }

  const result = await checkGrammar(textContent);

  const formattedResult = {
    status: result.status,
    text_length: textContent.length,
    total_errors: result.errors?.length || 0,
    errors: result.errors || [],
    corrected_text: result.corrected_text || null,
    statistics: {
      grammar_errors: result.errors?.filter(e => e.category === 'grammar').length || 0,
      spelling_errors: result.errors?.filter(e => e.category === 'spelling').length || 0,
      punctuation_errors: result.errors?.filter(e => e.category === 'punctuation').length || 0,
      style_issues: result.errors?.filter(e => e.category === 'style').length || 0
    }
  };

  sendSuccessResponse(res, formattedResult);
}));

router.post("/api/tools/grammarcheck", asyncHandler(async (req, res) => {
  const { text, content, input } = req.body;
  const textContent = text || content || input;

  const validation = validate.fields({ text: textContent }, {
    text: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  if (textContent.length < 10) {
    throw new ValidationError('Text must be at least 10 characters long', 400);
  }

  const result = await checkGrammar(textContent);

  const formattedResult = {
    status: result.status,
    text_length: textContent.length,
    total_errors: result.errors?.length || 0,
    errors: result.errors || [],
    corrected_text: result.corrected_text || null,
    statistics: {
      grammar_errors: result.errors?.filter(e => e.category === 'grammar').length || 0,
      spelling_errors: result.errors?.filter(e => e.category === 'spelling').length || 0,
      punctuation_errors: result.errors?.filter(e => e.category === 'punctuation').length || 0,
      style_issues: result.errors?.filter(e => e.category === 'style').length || 0
    }
  };

  sendSuccessResponse(res, formattedResult);
}));

router.metadata = {
  name: "Grammar Checker",
  path: "/api/tools/grammarcheck",
  methods: ['GET', 'POST'],
  category: "TOOLS",
  description: "Check grammar, spelling, and punctuation errors in text. Get detailed error reports with corrections and suggestions. Powered by EssayPro AI. Minimum 10 characters required.",
  params: [
    {
      name: "text",
      type: "text",
      required: true,
      placeholder: "The old lighthouse stood sentinel on the rugged cliff...",
      description: "Text to check (minimum 10 characters, also accepts: content, input)",
    },
  ],
};

module.exports = router;