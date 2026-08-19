'use strict';

const { Router } = require('express');
const axios      = require('axios');
const crypto     = require('crypto');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();
const UA = 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36';

router.get('/api/downloader/savetube', asyncHandler(async (req, res) => { await handle(req.query, res); }));
router.post('/api/downloader/savetube', asyncHandler(async (req, res) => { await handle(req.body, res); }));

async function handle({ url, format = '720' }, res) {
    if (!url) throw new ValidationError('Parameter "url" wajib diisi.');
    const patterns = [/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/, /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/, /youtu\.be\/([a-zA-Z0-9_-]{11})/];
    const id = patterns.find(p => p.test(url))?.[Symbol.match](url)?.[1];
    if (!id) throw new ValidationError('URL YouTube tidak valid.');
    if (!['144', '240', '360', '480', '720', '1080', 'mp3'].includes(format)) throw new ValidationError('Available formats: 144, 240, 360, 480, 720, 1080, mp3.');
    const api = axios.create({ headers: { 'content-type': 'application/json', origin: 'https://yt.savetube.me', 'user-agent': UA } });
    const { data: { cdn } } = await api.get('https://media.savetube.vip/api/random-cdn');
    const { data: { data: encryptedData } } = await api.post(`https://${cdn}/v2/info`, { url: `https://www.youtube.com/watch?v=${id}` });
    const encrypted = Buffer.from(encryptedData, 'base64');
    const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from('C5D58EF67A7584E4A29F6C35BBC4EB12', 'hex'), encrypted.slice(0, 16));
    const decrypted = JSON.parse(Buffer.concat([decipher.update(encrypted.slice(16)), decipher.final()]).toString());
    const { data: { data: { downloadUrl } } } = await api.post(`https://${cdn}/download`, { id, downloadType: format === 'mp3' ? 'audio' : 'video', quality: format === 'mp3' ? '128' : format, key: decrypted.key });
    sendSuccessResponse(res, { title: decrypted.title || null, type: format === 'mp3' ? 'audio' : 'video', quality: format, duration: `${Math.floor(decrypted.duration/60).toString().padStart(2,'0')}:${(decrypted.duration%60).toString().padStart(2,'0')}`, cover: decrypted.thumbnail || `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, download_url: downloadUrl });
}

router.metadata = [
    { name: 'Savetube YT', path: '/api/downloader/savetube', methods: ['GET', 'POST'], category: 'DOWNLOADER', description: 'Download video/audio YouTube via Savetube.', params: [{ name: 'url', type: 'string', required: true }, { name: 'format', type: 'string', required: false }] },
];

module.exports = router;
