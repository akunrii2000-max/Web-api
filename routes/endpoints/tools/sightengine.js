'use strict';

const { Router } = require('express');
const axios      = require('axios');
const FormData   = require('form-data');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse }                     = require('../../../config/apikeyConfig');

const router  = Router();
const API_URL = 'https://api.sightengine.com/1.0/check.json';
const HEADERS = {
  'Accept'     : '*/*',
  'Referer'    : 'https://sightengine.com/',
  'User-Agent' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
};

async function checkImage(imageUrl, models = 'genai,deepfake') {
  const imgRes  = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
  const buffer  = Buffer.from(imgRes.data);
  const ext     = (imageUrl.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
  const formData = new FormData();
  formData.append('media',          buffer, { filename: `image.${ext}` });
  formData.append('models',         models);
  formData.append('opt_generators', 'on');
  const { data } = await axios.post(API_URL, formData, {
    headers: { ...HEADERS, ...formData.getHeaders() },
  });
  return data;
}

async function handle({ url, image, img, models }, res) {
  const imageUrl = url || image || img;
  if (!imageUrl || !validate.url(imageUrl)) throw new ValidationError('Parameter "url" gambar wajib diisi dan valid.');
  const result = await checkImage(imageUrl.trim(), models || 'genai,deepfake');
  sendSuccessResponse(res, { source_url: imageUrl, ...result });
}

router.get('/api/tools/sightengine',  asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/tools/sightengine', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = {
  name       : 'Sightengine Image Check',
  path       : '/api/tools/sightengine',
  methods    : ['GET', 'POST'],
  category   : 'TOOLS',
  description: 'Cek apakah gambar hasil AI/deepfake menggunakan Sightengine.',
  params     : [
    { name: 'url',    type: 'string', required: true,  description: 'URL gambar yang ingin dicek' },
    { name: 'models', type: 'string', required: false, description: 'Model deteksi (default: genai,deepfake)' },
  ],
};

module.exports = router;
