'use strict';

const { Router } = require('express');
const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');

const router = Router();

const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36';
const API = 'https://api.unblurimage.ai/api/upscaler';

function productserial() {
  const raw = [
    UA,
    process.platform,
    process.arch,
    Date.now(),
    Math.random()
  ].join('|');

  return crypto.createHash('md5').update(raw).digest('hex');
}

async function hdVideoEnhancer(videoUrl) {
  try {
    if (!validate.url(videoUrl)) {
      throw new ValidationError("Invalid video URL", 400);
    }

    const product = productserial();

    // ================= DOWNLOAD VIDEO =================
    const videoResponse = await axios.get(videoUrl, {
      responseType: "arraybuffer",
      headers: { 'user-agent': UA },
      timeout: 120000
    });

    const videoBuffer = Buffer.from(videoResponse.data);

    // ================= STEP 1: GET UPLOAD URL =================
    const formUpload = new FormData();
    formUpload.append('video_file_name', `video-${Date.now()}.mp4`);

    const uploadRes = await axios.post(
      `${API}/v1/ai-video-enhancer/upload-video`,
      formUpload,
      {
        headers: {
          ...formUpload.getHeaders(),
          'user-agent': UA,
          origin: 'https://unblurimage.ai',
          referer: 'https://unblurimage.ai/'
        }
      }
    );

    if (uploadRes.data?.code !== 100000) {
      throw new ValidationError("Failed to get upload URL", 500);
    }

    const { url: uploadUrl, object_name } = uploadRes.data.result;

    // ================= STEP 2: UPLOAD VIDEO =================
    await axios.put(uploadUrl, videoBuffer, {
      headers: {
        'content-type': 'video/mp4'
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    const cdnUrl = `https://cdn.unblurimage.ai/${object_name}`;

    // ================= STEP 3: CREATE JOB =================
    const formJob = new FormData();
    formJob.append('original_video_file', cdnUrl);
    formJob.append('resolution', '2k');
    formJob.append('is_preview', 'false');

    const jobRes = await axios.post(
      `${API}/v2/ai-video-enhancer/create-job`,
      formJob,
      {
        headers: {
          ...formJob.getHeaders(),
          'user-agent': UA,
          origin: 'https://unblurimage.ai',
          referer: 'https://unblurimage.ai/',
          'product-serial': product
        }
      }
    );

    if (jobRes.data?.code !== 100000) {
      throw new ValidationError("Failed to create job", 500);
    }

    const jobId = jobRes.data.result.job_id;

    // ================= STEP 4: POLLING =================
    let result;
    const start = Date.now();

    while (true) {
      const statusRes = await axios.get(
        `${API}/v2/ai-video-enhancer/get-job/${jobId}`,
        {
          headers: {
            'user-agent': UA,
            origin: 'https://unblurimage.ai',
            referer: 'https://unblurimage.ai/',
            'product-serial': product
          }
        }
      );

      const data = statusRes.data;

      if (data.code === 100000 && data.result?.output_url) {
        result = data.result;
        break;
      }

      if (data.code !== 300010) {
        throw new ValidationError("Job failed", 500);
      }

      if (Date.now() - start > 300000) {
        throw new ValidationError("Processing timeout (5 minutes)", 504);
      }

      await new Promise(r => setTimeout(r, 5000));
    }

    return {
      input_url: result.input_url,
      output_url: result.output_url,
      job_id: jobId
    };

  } catch (error) {
    if (error.code === "ECONNABORTED") {
      throw new ValidationError("Request timeout", 504);
    } else if (error instanceof ValidationError) {
      throw error;
    } else {
      throw new ValidationError(error.message || "Enhance failed", 500);
    }
  }
}

// ================= ROUTES =================

router.get("/api/tools/hd-video", asyncHandler(async (req, res) => {
  const { url } = req.query;

  if (!validate.url(url)) {
    throw new ValidationError("Valid video URL is required", 400);
  }

  const result = await hdVideoEnhancer(url.trim());

  res.json({
    success: true,
    data: result,
    message: "Video enhanced successfully (2K)",
    timestamp: new Date().toISOString()
  });
}));

router.post("/api/tools/hd-video", asyncHandler(async (req, res) => {
  const { url } = req.body;

  if (!validate.url(url)) {
    throw new ValidationError("Valid video URL is required", 400);
  }

  const result = await hdVideoEnhancer(url.trim());

  res.json({
    success: true,
    data: result,
    message: "Video enhanced successfully (2K)",
    timestamp: new Date().toISOString()
  });
}));

module.exports = router;