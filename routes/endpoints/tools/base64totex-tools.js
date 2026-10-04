'use strict';

const { Router } = require('express');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

function decodeBase64ToText(base64String) {
  try {
    const text = Buffer.from(base64String, "base64").toString("utf-8");
    return {
      base64: base64String,
      text: text,
      length: text.length
    };
  } catch (error) {
    throw new ValidationError("Invalid Base64 string provided", 400);
  }
}

router.get("/api/tools/base642text", asyncHandler(async (req, res) => {
  const { base64 } = req.query;

  const validation = validate.fields({ base64 }, {
    base64: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = decodeBase64ToText(base64.trim());
  sendSuccessResponse(res, result);
}));

router.post("/api/tools/base642text", asyncHandler(async (req, res) => {
  const { base64 } = req.body;

  const validation = validate.fields({ base64 }, {
    base64: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = decodeBase64ToText(base64.trim());
  sendSuccessResponse(res, result);
}));

router.metadata = {
  name: "Base64 to Text",
  path: "/api/tools/base642text",
  methods: ['GET', 'POST'],
  category: "TOOLS",
  description: "Decode Base64 encoded string into plain text. Returns base64 string, decoded text, and text length.",
  params: [
    {
      name: "base64",
      type: "text",
      required: true,
      placeholder: "SGVsbG8gV29ybGQ=",
      description: "Base64 encoded string to decode",
    },
  ],
};

module.exports = router;