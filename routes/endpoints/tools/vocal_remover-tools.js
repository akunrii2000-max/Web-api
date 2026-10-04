'use strict';

const { Router } = require('express');
const axios = require('axios');
const FormData = require('form-data');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function vocalRemover(audioUrl) {
  try {
    if (!validate.url(audioUrl)) {
      throw new ValidationError("Invalid audio URL", 400);
    }

    const audioResponse = await axios.get(audioUrl, {
      responseType: "arraybuffer",
      timeout: 60000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    const audioBuffer = Buffer.from(audioResponse.data);

    const form = new FormData();
    form.append("fileName", audioBuffer, {
      filename: `audio_${Date.now()}.mp3`,
      contentType: "audio/mpeg"
    });

    const uploadResponse = await axios.post(
      "https://aivocalremover.com/api/v2/FileUpload",
      form,
      {
        headers: {
          ...form.getHeaders(),
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36"
        },
        timeout: 60000
      }
    );

    if (!uploadResponse?.data?.file_name) {
      throw new ValidationError("Upload failed", 500);
    }

    const processBody = new URLSearchParams({
      file_name: uploadResponse.data.file_name,
      action: "watermark_video",
      key: "X9QXlU9PaCqGWpnP1Q4IzgXoKinMsKvMuMn3RYXnKHFqju8VfScRmLnIGQsJBnbZFdcKyzeCDOcnJ3StBmtT9nDEXJn",
      web: "web"
    });

    const processResponse = await axios.post(
      "https://aivocalremover.com/api/v2/ProcessFile",
      processBody.toString(),
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36",
          "Content-Type": "application/x-www-form-urlencoded",
          origin: "https://aivocalremover.com",
          referer: "https://aivocalremover.com/"
        },
        timeout: 120000
      }
    );

    if (!processResponse?.data?.instrumental_path) {
      throw new ValidationError("Processing failed", 500);
    }

    return {
      instrumental: processResponse.data.instrumental_path || null,
      vocal: processResponse.data.vocal_path || null
    };
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      throw new ValidationError("Request timeout - Processing took too long", 504);
    } else if (error.response) {
      throw new ValidationError(
        `API error: ${error.response.status} - ${error.message}`,
        error.response.status
      );
    } else {
      throw new ValidationError(
        error.message || "Failed to remove vocals",
        500
      );
    }
  }
}

router.get("/api/tools/vocal-remover", asyncHandler(async (req, res) => {
  const { url } = req.query;

  if (!validate.url(url)) {
    throw new ValidationError("Valid audio URL is required", 400);
  }

  const result = await vocalRemover(url.trim());

  res.json({
    success: true,
    data: result,
    message: "Vocals removed successfully",
    timestamp: new Date().toISOString()
  });
}));

router.post("/api/tools/vocal-remover", asyncHandler(async (req, res) => {
  const { url } = req.body;

  if (!validate.url(url)) {
    throw new ValidationError("Valid audio URL is required", 400);
  }

  const result = await vocalRemover(url.trim());

  res.json({
    success: true,
    data: result,
    message: "Vocals removed successfully",
    timestamp: new Date().toISOString()
  });
}));

router.metadata = {
  name: "Vocal Remover",
  path: "/api/tools/vocal-remover",
  methods: ['GET', 'POST'],
  category: "TOOLS",
  description: "Remove vocals from audio files and get separated instrumental and vocal tracks using AI",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://example.com/audio.mp3",
      description: "Direct URL to audio file (MP3 format recommended)",
    },
  ],
};

module.exports = router;