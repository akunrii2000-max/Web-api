'use strict';

const { Router } = require('express');
const axios      = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();
const UA = 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36';

router.get('/api/tools/mlbbregioncheck', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/tools/mlbbregioncheck', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ user_id, zone_id }, res) {
    if (!user_id || isNaN(user_id)) throw new ValidationError('Parameter "user_id" wajib diisi (number).');
    if (!zone_id || isNaN(zone_id)) throw new ValidationError('Parameter "zone_id" wajib diisi (number).');
    const { data } = await axios.post('https://uncors.netlify.app/?destination=https://api-gw-prd.vocagame.com/gateway-ms/order/v1/client/transactions/verify', {
        shop_code: 'MOBILE_LEGENDS',
        data: { user_id: user_id.toString(), zone_id: zone_id.toString() }
    }, {
        headers: { origin: 'https://vocagame.com', referer: 'https://vocagame.com/', 'user-agent': UA, 'x-api-key': '4QG09jBHxuS4', 'x-client': 'web-mobile', 'x-country': 'ID', 'x-locale': 'id-id', 'x-timestamp': String(Date.now()) }
    });
    sendSuccessResponse(res, data.data);
}

router.metadata = [
    { name: 'MLBB Region Check', path: '/api/tools/mlbbregioncheck', methods: ['GET', 'POST'], category: 'TOOLS', description: 'Cek region akun Mobile Legends.', params: [{ name: 'user_id', type: 'string', required: true }, { name: 'zone_id', type: 'string', required: true }] },
];

module.exports = router;
