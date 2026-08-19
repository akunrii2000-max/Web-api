'use strict';

const { Router } = require('express');
const crypto = require('crypto');
const axios = require('axios');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function megaDownload(megaUrl) {
  try {

    const match = megaUrl.match(/mega\.nz\/(?:#!|file\/)([a-zA-Z0-9_-]+)[!#]([a-zA-Z0-9_-]+)/);

    if (!match) {
      throw new ValidationError('Invalid MEGA URL format', 400);
    }

    const [, fileId, key] = match;

    const { data } = await axios.post(
      'https://g.api.mega.co.nz/cs',
      [{ a: 'g', g: 1, ssl: 2, v: 2, p: fileId }],
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    const fileInfo = data[0];

    if (!fileInfo || !fileInfo.at) {
      throw new ValidationError('File not found or unavailable', 404);
    }

    const keyBuffer = Buffer.from(
      (key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (key.length % 4)) % 4)),
      'base64'
    );

    const paddedKey = Buffer.concat([
      keyBuffer,
      Buffer.alloc((4 - (keyBuffer.length % 4)) % 4)
    ]);

    let keyArray = Array.from(
      { length: paddedKey.length / 4 },
      (_, i) => paddedKey.readUInt32BE(i * 4)
    );

    if (keyArray.length === 8) {
      keyArray = [
        keyArray[0] ^ keyArray[4],
        keyArray[1] ^ keyArray[5],
        keyArray[2] ^ keyArray[6],
        keyArray[3] ^ keyArray[7]
      ];
    }

    const keyBuf = Buffer.alloc(keyArray.length * 4);
    keyArray.forEach((val, i) => keyBuf.writeUInt32BE(val >>> 0, i * 4));

    const encAttr = Buffer.from(
      (fileInfo.at.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (fileInfo.at.length % 4)) % 4)),
      'base64'
    );

    const decipher = crypto.createDecipheriv('aes-128-cbc', keyBuf, Buffer.alloc(16, 0));
    decipher.setAutoPadding(false);

    const decrypted = Buffer.concat([decipher.update(encAttr), decipher.final()]);
    const trimmed = decrypted.toString('utf8').replace(/\0+$/, '');

    const attributes = trimmed.startsWith('MEGA{')
      ? JSON.parse(trimmed.substring(4))
      : { n: 'Unknown' };

    const ext = attributes.n?.split('.').pop() || null;
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'pdf': 'application/pdf',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    };

    return {
      fileId,
      fileName: attributes.n || 'Unknown',
      fileSize: formatFileSize(fileInfo.s),
      fileSizeBytes: fileInfo.s,
      mimeType: mimeTypes[ext?.toLowerCase()] || 'application/octet-stream',
      downloadUrl: fileInfo.g
    };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || 'Failed to download from MEGA', 500);
  }
}

router.get("/api/download/mega", asyncHandler(async (req, res) => {
  const { url, link } = req.query;
  const megaUrl = url || link;

  const validation = validate.fields({ url: megaUrl }, {
    url: { required: true, type: "url", domain: "mega.nz" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await megaDownload(megaUrl.trim());

  sendSuccessResponse(res, {
    source_url: megaUrl,
    ...data
  });
}));

router.post("/api/download/mega", asyncHandler(async (req, res) => {
  const { url, link } = req.body;
  const megaUrl = url || link;

  const validation = validate.fields({ url: megaUrl }, {
    url: { required: true, type: "url", domain: "mega.nz" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await megaDownload(megaUrl.trim());

  sendSuccessResponse(res, {
    source_url: megaUrl,
    ...data
  });
}));

router.metadata = {
  name: "MEGA Downloader",
  path: "/api/download/mega",
  methods: ['GET', 'POST'],
  category: "DOWNLOADER",
  description: "Download files from MEGA.nz with file info and direct download link. Returns file name, size, mime type, and download URL.",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://mega.nz/file/EntxADbJ#UCXeVEZbEo0ci9xKBFJzgMPol39MfFecwoB-TXfp1yc",
      description: "MEGA.nz file URL (also accepts: link)",
    },
  ],
};

module.exports = router;