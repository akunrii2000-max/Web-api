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

async function figurine(imageBuffer) {
    try {
        const fd = new FormData();
        fd.append('image', imageBuffer, {
            filename: 'image.jpg',
            contentType: 'image/jpeg'
        });

        const response = await axios.post('https://gemini.antidonasi.web.id/figurine/', fd, {
            headers: {
                ...fd.getHeaders()
            },
            responseType: 'arraybuffer',
            timeout: 120000
        });

        if (response.status !== 200) {
            throw new ValidationError('Failed to process image with figurine API', 500);
        }

        return Buffer.from(response.data);
    } catch (error) {
        if (error instanceof ValidationError) throw error;

        if (error.code === 'ECONNABORTED') {
            throw new ValidationError('Request timeout. Image processing took too long', 408);
        }

        if (error.response) {
            throw new ValidationError(
                `Figurine API error: ${error.response.statusText}`,
                error.response.status
            );
        }

        throw new ValidationError(error.message || 'Failed to process figurine', 500);
    }
}

async function processFigurine(imageUrl) {
    try {

        const imageBuffer = await downloadImage(imageUrl);

        const result = await figurine(imageBuffer);

        return result;
    } catch (error) {
        if (error instanceof ValidationError) throw error;
        throw new ValidationError(error.message || 'Failed to create figurine', 500);
    }
}

router.get("/api/ai/figurine", asyncHandler(async (req, res) => {
    const { url, image, img } = req.query;
    const imageUrl = url || image || img;

    const validation = validate.fields({ imageUrl }, {
        imageUrl: { required: true, type: "url" },
    });

    if (!validation.valid) {
        throw new ValidationError(validation.errors.join(", "), 400);
    }

    const processedImage = await processFigurine(imageUrl);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', 'inline; filename="figurine.jpg"');
    res.send(processedImage);
}));

router.post("/api/ai/figurine", asyncHandler(async (req, res) => {
    const { url, image, img } = req.body;
    const imageUrl = url || image || img;

    const validation = validate.fields({ imageUrl }, {
        imageUrl: { required: true, type: "url" },
    });

    if (!validation.valid) {
        throw new ValidationError(validation.errors.join(", "), 400);
    }

    const processedImage = await processFigurine(imageUrl);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', 'inline; filename="figurine.jpg"');
    res.send(processedImage);
}));

router.metadata = {
    name: "To Figurine/Figura 2",
    path: "/api/ai/figurine",
    methods: ['GET', 'POST'],
    category: "AI",
    description: "Convert images to figurine/toy style using AI. Returns the processed image directly (not JSON). Powered by Gemini API.",
    params: [
        {
            name: "url",
            type: "text",
            required: true,
            placeholder: "https://example.com/photo.jpg",
            description: "Image URL to convert to figurine style (also accepts: image, img)",
        },
    ],
};

module.exports = router;