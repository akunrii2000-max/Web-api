'use strict';

const { Router } = require('express');
const axios = require('axios');
const FormData = require('form-data');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

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

async function ezremoveWatermark(imageBuffer, filename = 'image.jpg') {
  try {

    const form = new FormData();
    form.append('image_file', imageBuffer, filename);

    const createResponse = await axios.post(
      'https://api.ezremove.ai/api/ez-remove/watermark-remove/create-job',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          origin: 'https://ezremove.ai',
          'product-serial': 'sr-' + Date.now()
        },
        timeout: 30000
      }
    );

    const create = createResponse.data;

    if (!create || !create.result || !create.result.job_id) {
      throw new ValidationError('Failed to create removal job', 500);
    }

    const jobId = create.result.job_id;

    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const checkResponse = await axios.get(
        `https://api.ezremove.ai/api/ez-remove/watermark-remove/get-job/${jobId}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            origin: 'https://ezremove.ai',
            'product-serial': 'sr-' + Date.now()
          },
          timeout: 30000
        }
      );

      const check = checkResponse.data;

      if (check && check.code === 100000 && check.result && check.result.output) {
        return {
          status: 'success',
          job_id: jobId,
          result_url: check.result.output[0],
          processing_time: (i + 1) * 2
        };
      }

      if (!check || !check.code || check.code !== 300001) {

        break;
      }
    }

    throw new ValidationError('Processing timeout. Job is still being processed. Job ID: ' + jobId, 408);

  } catch (error) {
    if (error instanceof ValidationError) throw error;
    if (error.response) {
      throw new ValidationError(
        `EZ Remove API error: ${error.response.data?.message || error.response.statusText}`,
        error.response.status
      );
    }
    throw new ValidationError(error.message || 'Failed to remove watermark', 500);
  }
}

router.get("/api/tools/removewm", asyncHandler(async (req, res) => {
  const { url, image, img } = req.query;
  const imageUrl = url || image || img;

  const validation = validate.fields({ imageUrl }, {
    imageUrl: { required: true, type: "url" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const imageBuffer = await downloadImage(imageUrl);

  const filename = imageUrl.split('/').pop().split('?')[0] || 'image.jpg';

  const result = await ezremoveWatermark(imageBuffer, filename);

  sendSuccessResponse(res, {
    original_url: imageUrl,
    ...result
  });
}));

router.post("/api/tools/removewm", asyncHandler(async (req, res) => {
  const { url, image, img } = req.body;
  const imageUrl = url || image || img;

  const validation = validate.fields({ imageUrl }, {
    imageUrl: { required: true, type: "url" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const imageBuffer = await downloadImage(imageUrl);

  const filename = imageUrl.split('/').pop().split('?')[0] || 'image.jpg';

  const result = await ezremoveWatermark(imageBuffer, filename);

  sendSuccessResponse(res, {
    original_url: imageUrl,
    ...result
  });
}));

router.metadata = {
  name: "Remove Watermark",
  path: "/api/tools/removewm",
  methods: ['GET', 'POST'],
  category: "TOOLS",
  description: "Remove watermark from images. Provide image URL and get cleaned image. Processing may take 2-20 seconds depending on image complexity.",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://example.com/image-with-watermark.jpg",
      description: "Image URL to remove watermark from (also accepts: image, img)",
    },
  ],
};

module.exports = router;