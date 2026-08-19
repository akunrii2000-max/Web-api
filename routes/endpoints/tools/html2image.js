'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

router.get('/api/tools/html2image', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/tools/html2image', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ html, css = '', width = '720', height = '300', google_fonts = '' }, res) {
    if (!html) throw new ValidationError('Parameter "html" wajib diisi.');
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);
    if (isNaN(w) || w <= 0 || w > 10000) throw new ValidationError('Width harus angka antara 1-10000.');
    if (isNaN(h) || h <= 0 || h > 10000) throw new ValidationError('Height harus angka antara 1-10000.');
    const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36';
    const { headers } = await axios.get('https://htmlcsstoimage.com/', { headers: { 'user-agent': UA } });
    const { data } = await axios.post('https://htmlcsstoimage.com/image-demo', {
        html, css, google_fonts, full_screen: false, viewport_width: w, viewport_height: h,
        render_when_ready: false, color_scheme: 'light', timezone: 'UTC', block_consent_banners: false
    }, {
        headers: { 'content-type': 'application/json', cookie: headers['set-cookie'].join('; '), referer: 'https://htmlcsstoimage.com/', requestverificationtoken: 'undefined', 'user-agent': UA }
    });
    if (!data?.url) throw new Error('Failed to generate image.');
    sendSuccessResponse(res, { url: data.url });
}

router.metadata = [
    { name: 'HTML to Image', path: '/api/tools/html2image', methods: ['GET', 'POST'], category: 'TOOLS', description: 'Convert HTML+CSS menjadi gambar.', params: [{ name: 'html', type: 'string', required: true }, { name: 'css', type: 'string', required: false }, { name: 'width', type: 'number', required: false }, { name: 'height', type: 'number', required: false }] },
];

module.exports = router;
