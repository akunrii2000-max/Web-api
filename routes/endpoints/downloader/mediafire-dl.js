'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

class MediaFireDownloader {
  constructor() {
    this.axios = axios.create({
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      timeout: 30000,
    });
  }

  async extractDownloadUrl(mediafireUrl) {
    try {
      const response = await this.axios.get(mediafireUrl);
      const $ = cheerio.load(response.data);

      let downloadButton = $("#downloadButton");
      if (downloadButton.length && downloadButton.attr("href")) {
        return this._buildDownloadInfo($, downloadButton);
      }

      downloadButton = $("a.input.popsok");
      if (downloadButton.length && downloadButton.attr("href")) {
        return this._buildDownloadInfo($, downloadButton);
      }

      downloadButton = $(".download_link a.input");
      if (downloadButton.length && downloadButton.attr("href")) {
        return this._buildDownloadInfo($, downloadButton);
      }

      throw new ValidationError("Download button not found on MediaFire page", 404);
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ValidationError(error.message || "Failed to extract download URL", 500);
    }
  }

  _buildDownloadInfo($, downloadButton) {
    let downloadUrl = downloadButton.attr("href");

    if (downloadUrl.startsWith("//")) {
      downloadUrl = "https:" + downloadUrl;
    }

    const fileName = this._extractFilename($, downloadUrl);

    return {
      file_name: fileName,
      download_url: downloadUrl,
      mimetype: this._getMimetype(fileName),
      file_size: this._extractFilesize(downloadButton),
    };
  }

  _extractFilename($, downloadUrl) {
    try {

      const filenameMeta = $('meta[property="og:title"]').attr("content");
      if (filenameMeta) {
        return filenameMeta;
      }

      const title = $("title").text();
      if (title) {
        const filename = title.split(" - ")[0].trim();
        if (filename) {
          return filename;
        }
      }

      try {
        const url = new URL(downloadUrl);
        const pathParts = url.pathname.split("/");
        for (let i = pathParts.length - 1; i >= 0; i--) {
          if (pathParts[i] && pathParts[i].includes(".")) {
            return decodeURIComponent(pathParts[i]);
          }
        }
      } catch (e) {

      }

      return "unknown";
    } catch (e) {
      return "unknown";
    }
  }

  _extractFilesize(element) {
    try {
      const text = element.text();
      const match = text.match(/\(([0-9.]+\s*[KMGT]?B)\)/i);
      if (match) {
        return match[1];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  _getMimetype(filename) {
    if (!filename) return "application/octet-stream";

    const ext = filename.split(".").pop().toLowerCase();

    const mimetypes = {
      zip: "application/zip",
      rar: "application/x-rar-compressed",
      "7z": "application/x-7z-compressed",
      tar: "application/x-tar",
      gz: "application/gzip",
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      txt: "text/plain",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      bmp: "image/bmp",
      webp: "image/webp",
      svg: "image/svg+xml",
      mp4: "video/mp4",
      avi: "video/x-msvideo",
      mkv: "video/x-matroska",
      mov: "video/quicktime",
      wmv: "video/x-ms-wmv",
      flv: "video/x-flv",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
      flac: "audio/flac",
      m4a: "audio/mp4",
      exe: "application/x-msdownload",
      msi: "application/x-msi",
      apk: "application/vnd.android.package-archive",
      dmg: "application/x-apple-diskimage",
      html: "text/html",
      css: "text/css",
      js: "text/javascript",
      json: "application/json",
      xml: "application/xml",
    };

    return mimetypes[ext] || "application/octet-stream";
  }
}

router.get("/api/downloader/mediafire", asyncHandler(async (req, res) => {
  const { url } = req.query;

  const validation = validate.fields(
    { url },
    {
      url: {
        required: true,
        type: "url",
        domain: "mediafire.com",
      },
    }
  );

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const downloader = new MediaFireDownloader();
  const data = await downloader.extractDownloadUrl(url);

  sendSuccessResponse(res, data);
}));

router.post("/api/downloader/mediafire", asyncHandler(async (req, res) => {
  const { url } = req.body;

  const validation = validate.fields(
    { url },
    {
      url: {
        required: true,
        type: "url",
        domain: "mediafire.com",
      },
    }
  );

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const downloader = new MediaFireDownloader();
  const data = await downloader.extractDownloadUrl(url);

  sendSuccessResponse(res, data);
}));

router.metadata = {
  name: "MediaFire Downloader",
  path: "/api/downloader/mediafire",
  methods: ['GET', 'POST'],
  category: "DOWNLOADER",
  description: "Download files from MediaFire with 3 different extraction methods. Returns file name, download URL, mimetype, and file size.",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://www.mediafire.com/file/xxx/filename.zip/file",
      description: "MediaFire file URL",
    },
  ],
};

module.exports = router;