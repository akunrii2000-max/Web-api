'use strict';

const { Router }   = require('express');
const axios        = require('axios');
const FormData     = require('form-data');
const { asyncHandler, ValidationError } = require('../../../utils/validation');
const { sendSuccessResponse }           = require('../../../config/apikeyConfig');

const router   = Router();
const AJAX_URL = 'https://chat-deep.ai/wp-admin/admin-ajax.php';
const NONCE    = '7df78b0165';
const HEADERS  = {
  'User-Agent'      : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Accept'          : '*/*',
  'Accept-Language' : 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Origin'          : 'https://chat-deep.ai',
  'Referer'         : 'https://chat-deep.ai/deepseek-chat/',
  'Sec-Fetch-Dest'  : 'empty',
  'Sec-Fetch-Mode'  : 'cors',
  'Sec-Fetch-Site'  : 'same-origin',
};

async function sendMessage(message) {
  const formData = new FormData();
  formData.append('action',            'deepseek_chat');
  formData.append('message',           message);
  formData.append('model',             'default');
  formData.append('nonce',             NONCE);
  formData.append('save_conversation', '0');
  formData.append('session_only',      '1');

  const { data } = await axios.post(AJAX_URL, formData, {
    headers: { ...HEADERS, ...formData.getHeaders() },
  });

  const reply = data?.data?.response || null;
  if (!reply) throw new ValidationError('DeepAI tidak memberikan respons.');
  return reply;
}

async function handle({ message, text, prompt }, res) {
  const msg = message || text || prompt;
  if (!msg) throw new ValidationError('Parameter "message" wajib diisi.');
  const reply = await sendMessage(msg.trim());
  sendSuccessResponse(res, { message: msg, reply });
}

router.get('/api/ai/deepai',  asyncHandler(async (req, res) => handle(req.query, res)));
router.post('/api/ai/deepai', asyncHandler(async (req, res) => handle(req.body,  res)));

router.metadata = {
  name       : 'DeepAI Chat (DeepSeek)',
  path       : '/api/ai/deepai',
  methods    : ['GET', 'POST'],
  category   : 'AI',
  description: 'Chat dengan DeepSeek AI melalui chat-deep.ai.',
  params     : [{ name: 'message', type: 'string', required: true, description: 'Pesan yang akan dikirim ke AI' }],
};

module.exports = router;
