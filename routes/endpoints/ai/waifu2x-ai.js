'use strict';

const { Router } = require('express');
const axios = require('axios');
const FormData = require('form-data');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

const CONFIG = {
  styles: {
    artwork: 'art',
    scans: 'art_scan',
    photo: 'photo'
  },
  noises: {
    none: '-1',
    low: '0',
    medium: '1',
    high: '2',
    highest: '3'
  },
  upscaling: {
    none: '-1',
    '1.6x': '1',
    '2x': '2'
  }
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

async function getCfToken() {
  try {
    const { data } = await axios.post('https://api.nekolabs.web.id/tools/bypass/cf-turnstile', {
      url: 'https://www.waifu2x.net/',
      siteKey: '0x4AAAAAABqlY7DKXMzoS81U'
    }, {
      timeout: 30000
    });

    if (!data?.result) {
      throw new ValidationError('Failed to get CF token', 500);
    }

    return data.result;
  } catch (error) {
    throw new ValidationError('CF token generation failed', 500);
  }
}

async function waifu2xEnhance(imageBuffer, style = 'artwork', noise = 'medium', upscale = '1.6x') {
  try {

    if (!CONFIG.styles[style]) {
      throw new ValidationError(
        `Invalid style. Available: ${Object.keys(CONFIG.styles).join(', ')}`,
        400
      );
    }

    if (!CONFIG.noises[noise]) {
      throw new ValidationError(
        `Invalid noise level. Available: ${Object.keys(CONFIG.noises).join(', ')}`,
        400
      );
    }

    if (!CONFIG.upscaling[upscale]) {
      throw new ValidationError(
        `Invalid upscaling. Available: ${Object.keys(CONFIG.upscaling).join(', ')}`,
        400
      );
    }

    const cfToken = await getCfToken();

    const form = new FormData();
    form.append('recap', '');
    form.append('turnstile', cfToken);
    form.append('url', '');
    form.append('file', imageBuffer, `${Date.now()}_rynn.jpg`);
    form.append('style', CONFIG.styles[style]);
    form.append('noice', CONFIG.noises[noise]);
    form.append('scale', CONFIG.upscaling[upscale]);
    form.append('format', '0');
    form.append('cf-turnstile-response', '');

    const { data } = await axios.post('https://www.waifu2x.net/api', form, {
      headers: {
        ...form.getHeaders(),
        origin: 'https://www.waifu2x.net',
        referer: 'https://www.waifu2x.net/',
        'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
      },
      responseType: 'arraybuffer',
      timeout: 120000
    });

    return Buffer.from(data);
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || 'Failed to enhance image with Waifu2x', 500);
  }
}

router.get("/api/ai/waifu2x", asyncHandler(async (req, res) => {
  const { url, image, img, style, noise, noice, upscale, upscaling } = req.query;
  const imageUrl = url || image || img;
  const selectedStyle = style || 'artwork';
  const selectedNoise = noise || noice || 'medium';
  const selectedUpscale = upscale || upscaling || '1.6x';

  const validation = validate.fields({ imageUrl }, {
    imageUrl: { required: true, type: "url" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const imageBuffer = await downloadImage(imageUrl);

  const enhancedBuffer = await waifu2xEnhance(imageBuffer, selectedStyle, selectedNoise, selectedUpscale);

  res.set("Content-Type", "image/png");
  res.set("Content-Length", enhancedBuffer.length.toString());
  res.set("Cache-Control", "public, max-age=3600");
  res.set("X-Original-URL", imageUrl);
  res.set("X-Style", selectedStyle);
  res.set("X-Noise-Reduction", selectedNoise);
  res.set("X-Upscaling", selectedUpscale);
  res.send(enhancedBuffer);
}));

router.post("/api/ai/waifu2x", asyncHandler(async (req, res) => {
  const { url, image, img, style, noise, noice, upscale, upscaling } = req.body;
  const imageUrl = url || image || img;
  const selectedStyle = style || 'artwork';
  const selectedNoise = noise || noice || 'medium';
  const selectedUpscale = upscale || upscaling || '1.6x';

  const validation = validate.fields({ imageUrl }, {
    imageUrl: { required: true, type: "url" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const imageBuffer = await downloadImage(imageUrl);

  const enhancedBuffer = await waifu2xEnhance(imageBuffer, selectedStyle, selectedNoise, selectedUpscale);

  res.set("Content-Type", "image/png");
  res.set("Content-Length", enhancedBuffer.length.toString());
  res.set("Cache-Control", "public, max-age=3600");
  res.set("X-Original-URL", imageUrl);
  res.set("X-Style", selectedStyle);
  res.set("X-Noise-Reduction", selectedNoise);
  res.set("X-Upscaling", selectedUpscale);
  res.send(enhancedBuffer);
}));

router.metadata = {
  name: "Waifu2x Image Enhancer",
  path: "/api/ai/waifu2x",
  methods: ['GET', 'POST'],
  category: "AI",
  description: `Enhance and upscale images using Waifu2x AI. Returns enhanced image directly as PNG. Styles: ${Object.keys(CONFIG.styles).join(', ')}. Noise: ${Object.keys(CONFIG.noises).join(', ')}. Upscaling: ${Object.keys(CONFIG.upscaling).join(', ')}.`,
  responseBinary: true,
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://example.com/image.jpg",
      description: "Image URL to enhance (also accepts: image, img)",
    },
    {
      name: "style",
      type: "text",
      required: false,
      placeholder: "artwork",
      description: `Image style: ${Object.keys(CONFIG.styles).join(', ')}. Default: artwork`,
      default: "artwork",
      options: Object.keys(CONFIG.styles).map(function(k) { return { value: k, label: k }; }),
    },
    {
      name: "noise",
      type: "text",
      required: false,
      placeholder: "medium",
      description: `Noise reduction: ${Object.keys(CONFIG.noises).join(', ')}. Default: medium (also accepts: noice)`,
      default: "medium",
      options: Object.keys(CONFIG.noises).map(function(k) { return { value: k, label: k }; }),
    },
    {
      name: "upscale",
      type: "text",
      required: false,
      placeholder: "1.6x",
      description: `Upscaling factor: ${Object.keys(CONFIG.upscaling).join(', ')}. Default: 1.6x (also accepts: upscaling)`,
      default: "1.6x",
      options: Object.keys(CONFIG.upscaling).map(function(k) { return { value: k, label: k }; }),
    },
  ],
};

module.exports = router;