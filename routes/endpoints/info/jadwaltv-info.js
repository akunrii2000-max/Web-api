'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function scrapeJadwalTV(channel) {
  const baseUrl = "https://www.jadwaltv.net";
  const jadwalTVNowUrl = `${baseUrl}/channel/acara-tv-nasional-saat-ini`;
  const jadwalChannelUrl = `${baseUrl}/channel/${channel}`;

  try {
    const url = !channel ? jadwalTVNowUrl : jadwalChannelUrl.toLowerCase();

    const { data } = await axios.get(url, {
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    const $ = cheerio.load(data);

    if (!channel) {
      const jadwal = [];
      let currentChannel = "";

      $("table.table-bordered tbody tr").each((index, element) => {
        const isChannelRow = $(element).find("td[colspan=2]").length > 0;

        if (isChannelRow) {
          currentChannel = $(element).find("a").text().trim();
        } else {
          const jam = $(element).find("td").first().text().trim();
          const acara = $(element).find("td").last().text().trim();

          if (jam && acara && currentChannel) {
            const existingChannel = jadwal.find(
              (j) => j.channel === currentChannel
            );

            if (existingChannel) {
              existingChannel.jadwal.push({ jam, acara });
            } else {
              jadwal.push({
                channel: currentChannel,
                jadwal: [{ jam, acara }],
              });
            }
          }
        }
      });

      return jadwal;
    } else {
      const jadwal = [];

      $("table.table-bordered tbody tr").each((index, element) => {
        const jam = $(element).find("td").first().text().trim();
        const acara = $(element).find("td").last().text().trim();

        if (jam && acara && jam !== "Jam" && acara !== "Acara") {
          jadwal.push({ jam, acara });
        }
      });

      return jadwal;
    }
  } catch (error) {
    throw new ValidationError(
      error.message || "Failed to retrieve TV schedule",
      500
    );
  }
}

router.get("/api/info/jadwaltv", asyncHandler(async (req, res) => {
  const { channel } = req.query;

  if (channel && typeof channel !== "string") {
    throw new ValidationError("Channel parameter must be a string", 400);
  }

  if (channel && channel.trim().length === 0) {
    throw new ValidationError("Channel parameter cannot be empty", 400);
  }

  if (channel && channel.length > 50) {
    throw new ValidationError("Channel parameter must be less than 50 characters", 400);
  }

  const result = await scrapeJadwalTV(channel ? channel.trim() : null);

  if (!result || (Array.isArray(result) && result.length === 0)) {
    throw new ValidationError("No TV schedule found", 404);
  }

  sendSuccessResponse(res, {
    channel: channel || "all",
    schedule: result,
  });
}));

router.post("/api/info/jadwaltv", asyncHandler(async (req, res) => {
  const { channel } = req.body;

  if (channel && typeof channel !== "string") {
    throw new ValidationError("Channel parameter must be a string", 400);
  }

  if (channel && channel.trim().length === 0) {
    throw new ValidationError("Channel parameter cannot be empty", 400);
  }

  if (channel && channel.length > 50) {
    throw new ValidationError("Channel parameter must be less than 50 characters", 400);
  }

  const result = await scrapeJadwalTV(channel ? channel.trim() : null);

  if (!result || (Array.isArray(result) && result.length === 0)) {
    throw new ValidationError("No TV schedule found", 404);
  }

  sendSuccessResponse(res, {
    channel: channel || "all",
    schedule: result,
  });
}));

router.metadata = {
  name: "TV Schedule (Jadwal TV)",
  path: "/api/info/jadwaltv",
  methods: ['GET', 'POST'],
  category: "INFO",
  description: "Get current TV schedule for Indonesian TV channels. Returns broadcast time and program names for all national channels or a specific channel if provided.",
  params: [
    {
      name: "channel",
      type: "text",
      required: false,
      placeholder: "sctv",
      description: "TV channel name (optional, leave empty for all channels)",
    },
  ],
};

module.exports = router;