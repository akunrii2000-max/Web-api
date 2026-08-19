'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function downloadGDrive(url) {
  try {
    if (!/drive\.google\.com\/file\/d\//gi.test(url)) {
      throw new ValidationError("Invalid Google Drive URL", 400);
    }

    const urlParts = url.split("/");
    const fileIdIndex = urlParts.indexOf("d") + 1;

    if (fileIdIndex === 0 || !urlParts[fileIdIndex]) {
      throw new ValidationError("File ID not found in URL", 400);
    }

    const fileId = urlParts[fileIdIndex];

    const { data } = await axios.get(url, {
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    const $ = cheerio.load(data);

    let fileName = $("head").find("title").text();

    if (fileName) {

      fileName = fileName.split(" - ")[0].trim();
    } else {
      fileName = "Unknown";
    }

    const downloadUrl = `https://drive.usercontent.google.com/uc?id=${fileId}&export=download`;

    return {
      fileName,
      fileId,
      downloadUrl,
      sourceUrl: url
    };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || 'Failed to get Google Drive download link', 500);
  }
}

router.get("/api/download/gdrive", asyncHandler(async (req, res) => {
  const { url, link } = req.query;
  const gdriveUrl = url || link;

  const validation = validate.fields({ url: gdriveUrl }, {
    url: { required: true, type: "url", domain: "drive.google.com" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await downloadGDrive(gdriveUrl.trim());

  sendSuccessResponse(res, data);
}));

router.post("/api/download/gdrive", asyncHandler(async (req, res) => {
  const { url, link } = req.body;
  const gdriveUrl = url || link;

  const validation = validate.fields({ url: gdriveUrl }, {
    url: { required: true, type: "url", domain: "drive.google.com" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await downloadGDrive(gdriveUrl.trim());

  sendSuccessResponse(res, data);
}));

router.metadata = {
  name: "Google Drive Downloader",
  path: "/api/download/gdrive",
  methods: ['GET', 'POST'],
  category: "DOWNLOADER",
  description: "Get direct download link from Google Drive. Returns file name, file ID, and direct download URL.",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://drive.google.com/file/d/1ABC123xyz/view",
      description: "Google Drive file URL (also accepts: link)",
    },
  ],
};

module.exports = router;