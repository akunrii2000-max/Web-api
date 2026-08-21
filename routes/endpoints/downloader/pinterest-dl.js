'use strict';

const { Router } = require('express');
const FormData = require('form-data');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

const pinterestDownloader = {
  _static: Object.freeze({
    baseUrl: 'https://pindown.io',
    baseHeaders: {
      'accept-encoding': 'gzip, deflate, br, zstd',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  }),

  getCookieAndToken: async function () {
    try {
      const r = await fetch(this._static.baseUrl, {
        headers: this._static.baseHeaders
      });

      if (!r.ok) {
        throw new Error(`${r.status} ${r.statusText}`);
      }

      const html = await r.text();
      const cookie = r.headers.getSetCookie().map(k => k.split(';')[0]).join('; ');

      if (!cookie) {
        throw new Error('Failed to get cookie');
      }

      const hidden = html.match(/<input name="(?<name>.+?)" type="hidden" value="(?<value>.+?)"/)?.groups;

      if (!hidden) {
        throw new Error('Failed to get hidden value');
      }

      return { cookie, hidden };
    } catch (error) {
      throw new Error(`Cookie/Token error: ${error.message}`);
    }
  },

  downloadVideo: async function (pinterestUrl) {
    try {
      if (!/pinterest\.com/.test(pinterestUrl)) {
        throw new ValidationError('Invalid Pinterest URL', 400);
      }

      const { cookie, hidden } = await this.getCookieAndToken();

      const body = new FormData();
      body.append('url', pinterestUrl);
      body.append(hidden.name, hidden.value);

      const r = await fetch(this._static.baseUrl + '/action', {
        headers: {
          cookie,
          ...this._static.baseHeaders
        },
        body,
        method: 'post'
      });

      if (!r.ok) {
        throw new Error(`${r.status} ${r.statusText}`);
      }

      const html = await r.text();

      const vidMatch = html.match(/id='vid' src='(.+?)'/)?.[1];
      if (!vidMatch) {
        throw new ValidationError('Video URL not found', 404);
      }

      const videoUrl = vidMatch;

      if (!videoUrl) {
        throw new ValidationError('Failed to extract video URL', 500);
      }

      const thumbMatch = html.match(/video poster='(.+?)'/)?.[1];
      const thumbnailUrl = thumbMatch || null;

      return {
        videoUrl,
        thumbnailUrl
      };
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ValidationError(error.message || 'Failed to download Pinterest video', 500);
    }
  }
};

router.get("/api/download/pinterest", asyncHandler(async (req, res) => {
  const { url, link } = req.query;
  const pinterestUrl = url || link;

  const validation = validate.fields({ url: pinterestUrl }, {
    url: { required: true, type: "url", domain: "pinterest.com" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await pinterestDownloader.downloadVideo(pinterestUrl.trim());

  sendSuccessResponse(res, {
    source_url: pinterestUrl,
    ...data
  });
}));

router.post("/api/download/pinterest", asyncHandler(async (req, res) => {
  const { url, link } = req.body;
  const pinterestUrl = url || link;

  const validation = validate.fields({ url: pinterestUrl }, {
    url: { required: true, type: "url", domain: "pinterest.com" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await pinterestDownloader.downloadVideo(pinterestUrl.trim());

  sendSuccessResponse(res, {
    source_url: pinterestUrl,
    ...data
  });
}));

router.metadata = {
  name: "Pinterest Video Downloader",
  path: "/api/download/pinterest",
  methods: ['GET', 'POST'],
  category: "DOWNLOADER",
  description: "Download videos from Pinterest with thumbnail. Returns video URL and thumbnail URL.",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://www.pinterest.com/pin/614811786672974800/",
      description: "Pinterest video URL (also accepts: link)",
    },
  ],
};

module.exports = router;