'use strict';

const { Router } = require('express');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');
const { generateIQC } = require('iqc-canvas');

const router = Router();

function isValidTimeFormat(time) {
  const timeRegex = /^([0-1]?[0-9]|2[0-3])[:.]([0-5][0-9])$/;
  return timeRegex.test(time);
}

function normalizeTime(time) {
  return time.replace(':', '.');
}

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}`;
}

function parseBoolean(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  const str = String(value).toLowerCase();
  return str === 'true' || str === '1' || str === 'yes';
}

async function createIQC(params) {
  try {
    const {
      text,
      time = getCurrentTime(),
      battery = null,
      operator = false,
      wifi = false,
      timebar = false
    } = params;

    if (!text || text.trim().length === 0) {
      throw new ValidationError('Text cannot be empty', 400);
    }

    if (text.length > 200) {
      throw new ValidationError('Text too long! Maximum 200 characters', 400);
    }

    if (!isValidTimeFormat(time)) {
      throw new ValidationError(
        'Invalid time format! Use HH:MM or HH.MM (e.g., 23:13 or 12.30)',
        400
      );
    }

    if (battery !== null) {
      const batteryNum = parseInt(battery, 10);
      if (isNaN(batteryNum) || batteryNum < 0 || batteryNum > 100) {
        throw new ValidationError('Battery must be between 0-100', 400);
      }
    }

    const normalizedTime = normalizeTime(time);

    const options = {
      baterai: battery !== null ? [true, battery.toString()] : [false, "0"],
      operator: parseBoolean(operator),
      wifi: parseBoolean(wifi),
      timebar: parseBoolean(timebar)
    };

    const result = await generateIQC(text, normalizedTime, options);

    if (!result || !result.image) {
      throw new ValidationError('Failed to generate quote canvas', 500);
    }

    return result.image;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || 'Failed to generate IQC', 500);
  }
}

router.get("/api/maker/iqc", asyncHandler(async (req, res) => {
  const {
    text,
    time,
    battery,
    baterai,
    operator,
    wifi,
    timebar
  } = req.query;

  const validation = validate.fields({ text }, {
    text: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const imageBuffer = await createIQC({
    text: text.trim(),
    time: time || getCurrentTime(),
    battery: battery || baterai || null,
    operator: operator || false,
    wifi: wifi || false,
    timebar: timebar || false
  });

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', 'inline; filename="iqc_quote.png"');
  res.send(imageBuffer);
}));

router.post("/api/maker/iqc", asyncHandler(async (req, res) => {
  const {
    text,
    time,
    battery,
    baterai,
    operator,
    wifi,
    timebar
  } = req.body;

  const validation = validate.fields({ text }, {
    text: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const imageBuffer = await createIQC({
    text: text.trim(),
    time: time || getCurrentTime(),
    battery: battery || baterai || null,
    operator: operator || false,
    wifi: wifi || false,
    timebar: timebar || false
  });

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', 'inline; filename="iqc_quote.png"');
  res.send(imageBuffer);
}));

router.metadata = {
  name: "IQC MAKER",
  path: "/api/maker/iqc",
  methods: ['GET', 'POST'],
  category: "TOOLS",
  description: "Generate Instagram-style quote images with customizable time, battery, operator, wifi, and timebar indicators. Returns image directly (PNG). Supports up to 200 characters.",
  responseBinary: true,
  params: [
    {
      name: "text",
      type: "text",
      required: true,
      placeholder: "kalau gw sih bodo amat 😂",
      description: "Quote text (max 200 characters)",
    },
    {
      name: "time",
      type: "text",
      required: false,
      placeholder: "23.13",
      description: "Time in HH:MM or HH.MM format (default: current time)",
    },
    {
      name: "battery",
      type: "number",
      required: false,
      placeholder: "85",
      description: "Battery percentage 0-100 (also accepts: baterai). Hidden if not provided",
    },
    {
      name: "operator",
      type: "boolean",
      required: false,
      placeholder: "true",
      description: "Show operator indicator (true/false, default: false)",
    },
    {
      name: "wifi",
      type: "boolean",
      required: false,
      placeholder: "true",
      description: "Show wifi indicator (true/false, default: false)",
    },
    {
      name: "timebar",
      type: "boolean",
      required: false,
      placeholder: "true",
      description: "Show timebar indicator (true/false, default: false)",
    },
  ],
};

module.exports = router;