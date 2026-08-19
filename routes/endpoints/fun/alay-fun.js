'use strict';

const { Router } = require('express');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

function convertToAlay(text) {
  const result = text
    .replace(/[a-z]/gi, (v) =>
      Math.random() > 0.5
        ? v[["toLowerCase", "toUpperCase"][Math.floor(2 * Math.random())]]()
        : v
    )
    .replace(/[abegiors]/gi, (v) => {
      if (Math.random() > 0.5) return v;
      switch (v.toLowerCase()) {
        case "a":
          return "4";
        case "b":
          return Math.random() > 0.5 ? "8" : "13";
        case "e":
          return "3";
        case "g":
          return Math.random() > 0.5 ? "6" : "9";
        case "i":
          return "1";
        case "o":
          return "0";
        case "r":
          return "12";
        case "s":
          return "5";
        default:
          return v;
      }
    });
  return result;
}

router.get("/api/fun/alay", asyncHandler(async (req, res) => {
  const { text, q, input } = req.query;
  const textContent = text || q || input;

  const validation = validate.fields({ text: textContent }, {
    text: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  if (textContent.length > 1000) {
    throw new ValidationError("Text must be less than 1000 characters", 400);
  }

  const result = convertToAlay(textContent.trim());

  sendSuccessResponse(res, {
    original: textContent,
    alay: result,
  });
}));

router.post("/api/fun/alay", asyncHandler(async (req, res) => {
  const { text, q, input } = req.body;
  const textContent = text || q || input;

  const validation = validate.fields({ text: textContent }, {
    text: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  if (textContent.length > 1000) {
    throw new ValidationError("Text must be less than 1000 characters", 400);
  }

  const result = convertToAlay(textContent.trim());

  sendSuccessResponse(res, {
    original: textContent,
    alay: result,
  });
}));

router.metadata = {
  name: "Alay Text Converter",
  path: "/api/fun/alay",
  methods: ['GET', 'POST'],
  category: "FUN",
  description: "Convert text to Alay style (Indonesian internet slang). Applies random capitalization and substitutes letters with numbers to create the characteristic Alay aesthetic.",
  params: [
    {
      name: "text",
      type: "text",
      required: true,
      placeholder: "Hello World",
      description: "Text to convert to Alay style (also accepts: q, input)",
    },
  ],
};

module.exports = router;