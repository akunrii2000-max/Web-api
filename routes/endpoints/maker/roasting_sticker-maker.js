'use strict';

const { Router } = require('express');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

let createCanvas, loadImage, registerFont;
try { const canvas = require('canvas'); createCanvas = canvas.createCanvas; loadImage = canvas.loadImage; registerFont = canvas.registerFont; } catch(e) { createCanvas = loadImage = registerFont = function() { throw new Error('Canvas module not installed. Run: npm install canvas'); }; }

async function generateRoastingSticker(data) {
  try {
    const width = 512;
    const height = 512;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const marginXText = 70;
    const marginXTitle = 30;
    const maxWidthTop = width - marginXText * 2;
    const maxWidthTitle = width - marginXTitle * 2;
    const maxWidthBottom = width - marginXText * 2;

    const lineHeightSmall = 34;
    const spacingAfterT1 = 14;
    const spacingAfterT2 = 18;
    const maxTitleLines = 2;

    function wrapText(ctx, text, maxWidth) {
      const words = text.split(" ");
      const lines = [];
      let line = "";

      for (let i = 0; i < words.length; i++) {
        const testLine = line ? line + " " + words[i] : words[i];
        const { width } = ctx.measureText(testLine);
        if (width > maxWidth && line) {
          lines.push(line);
          line = words[i];
        } else {
          line = testLine;
        }
      }
      if (line) lines.push(line);
      return lines;
    }

    ctx.font = "28px sans-serif";
    let lines1 = wrapText(ctx, data.text1, maxWidthTop);
    const heightT1 = lines1.length * lineHeightSmall;

    let fontSizeTitle = 60;
    let lines2;

    while (fontSizeTitle > 30) {
      ctx.font = `bold ${fontSizeTitle}px sans-serif`;
      lines2 = wrapText(ctx, data.text2, maxWidthTitle);
      if (lines2.length <= maxTitleLines) break;
      fontSizeTitle -= 2;
    }

    const lineHeightTitle = fontSizeTitle + 6;
    const heightT2 = lines2.length * lineHeightTitle;

    ctx.font = "28px sans-serif";
    let lines3 = wrapText(ctx, data.text3, maxWidthBottom);
    const heightT3 = lines3.length * lineHeightSmall;

    const totalHeight =
      heightT1 + spacingAfterT1 + heightT2 + spacingAfterT2 + heightT3;

    let y = (height - totalHeight) / 2;

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#6b7280";
    ctx.font = "28px sans-serif";

    for (const line of lines1) {
      ctx.fillText(line, marginXText, y);
      y += lineHeightSmall;
    }
    y += spacingAfterT1;

    ctx.fillStyle = "#000000";
    ctx.font = `bold ${fontSizeTitle}px sans-serif`;

    for (const line of lines2) {
      ctx.fillText(line, marginXTitle, y);
      y += lineHeightTitle;
    }
    y += spacingAfterT2;

    ctx.fillStyle = "#6b7280";
    ctx.font = "28px sans-serif";

    for (const line of lines3) {
      ctx.fillText(line, marginXText, y);
      y += lineHeightSmall;
    }

    return canvas.toBuffer("image/png");
  } catch (error) {
    throw new ValidationError(
      error.message || "Failed to generate roasting sticker",
      500
    );
  }
}

router.get("/api/m/roasting-sticker", asyncHandler(async (req, res) => {
  const { text1, text2, text3 } = req.query;

  if (!text1 || !text2 || !text3) {
    throw new ValidationError("Missing required parameters: text1, text2, and text3", 400);
  }

  const data = {
    text1: text1.trim(),
    text2: text2.trim().toUpperCase(),
    text3: text3.trim(),
  };

  const imageBuffer = await generateRoastingSticker(data);

  res.set("Content-Type", "image/png");
  res.set("Content-Length", imageBuffer.length);
  res.set("Cache-Control", "public, max-age=3600");
  res.send(imageBuffer);
}));

router.post("/api/m/roasting-sticker", asyncHandler(async (req, res) => {
  const { text1, text2, text3 } = req.body;

  if (!text1 || !text2 || !text3) {
    throw new ValidationError("Missing required parameters: text1, text2, and text3", 400);
  }

  const data = {
    text1: text1.trim(),
    text2: text2.trim().toUpperCase(),
    text3: text3.trim(),
  };

  const imageBuffer = await generateRoastingSticker(data);

  res.set("Content-Type", "image/png");
  res.set("Content-Length", imageBuffer.length);
  res.set("Cache-Control", "public, max-age=3600");
  res.send(imageBuffer);
}));

router.metadata = {
  name: "Roasting Sticker Generator",
  path: "/api/m/roasting-sticker",
  methods: ['GET', 'POST'],
  category: "MAKER",
  description: "Generate roasting/meme text sticker images with three customizable text sections. Returns PNG image formatted for stickers.",
  params: [
    {
      name: "text1",
      type: "text",
      required: true,
      placeholder: "eh lu kalok gabisa ngoding jangan maksa deh kacung",
      description: "Top text (gray, small font)",
    },
    {
      name: "text2",
      type: "text",
      required: true,
      placeholder: "GG BANG CODENYA",
      description: "Middle text (bold, large font, automatically uppercase)",
    },
    {
      name: "text3",
      type: "text",
      required: true,
      placeholder: "idiot coding copy sana sini ngapain di publish",
      description: "Bottom text (gray, small font)",
    },
  ],
};

module.exports = router;