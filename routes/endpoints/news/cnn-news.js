'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment-timezone');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();
const base_url = "https://www.cnnindonesia.com";

async function scrapeCNNIndonesiaNews() {
  try {
    const response = await axios.get(base_url);
    const $ = cheerio.load(response.data);
    const isi = $("div.nhl-list article.flex-grow");
    const result = [];

    for (let i = 0; i < isi.length; i++) {
      const e = isi[i];
      const tagA = $("a.flex", e);

      if (tagA && tagA.attr("dtr-ttl")) {
        const title = tagA.attr("dtr-ttl")?.replace("\n", "").trim();
        const image_thumbnail = $("img", tagA).attr("src");
        const link = tagA.attr("href");

        if (!title || !image_thumbnail || !link) continue;

        const url = new URL(image_thumbnail);
        const search_params = url.searchParams;
        search_params.set("w", "1024");
        search_params.set("q", "100");
        url.search = search_params.toString();
        const image_full = url.toString();

        const timeMatch = link.split("/")[4]?.split("-")[0];
        const newTime = timeMatch ? moment(timeMatch, "YYYYMMDDhh:mm:ss").format("YYYY-MM-DD hh:mm") : "";
        const slug = link ? link.replace(base_url, "") : "";

        let content = "";
        try {
          const detailResponse = await axios.get(link);
          const $detail = cheerio.load(detailResponse.data);
          const contentElement = $detail("div.detail-wrap.flex.gap-4.relative");

          $("script", contentElement).remove();
          $("style", contentElement).remove();
          $(".paradetail", contentElement).remove();
          $(".detail_ads", contentElement).remove();
          $(".linksisip", contentElement).remove();
          $(".embed.videocnn", contentElement).remove();

          content = contentElement
            .text()
            .replace(/\\n/g, "")
            .replace(/Bagikan:/g, "")
            .replace(/url telah tercopy/g, "")
            .replace(/Ã®â‚¬dis\/tsaÃ®â‚¬/g, "")
            .replace(/Ã®â‚¬tim\/mikÃ®â‚¬/g, "")
            .replace(/Ã®â‚¬Gambas:Video CNNÃ®â‚¬/g, "")
            .replace(/\s{2,}/g, " ")
            .trim();
        } catch (err) {
          console.error(`Failed to fetch content for link: ${link}`, err.message);
        }

        result.push({
          title,
          image_thumbnail: image_thumbnail || null,
          image_full: image_full || null,
          time: newTime || null,
          link,
          slug: slug || null,
          content: content || null,
        });
      }
    }

    return result;
  } catch (error) {
    console.error("Error scraping CNN Indonesia News:", error);
    throw new ValidationError(error.message || "Failed to scrape CNN Indonesia News", 500);
  }
}

router.get("/api/news/cnn", asyncHandler(async (req, res) => {
  const data = await scrapeCNNIndonesiaNews();
  sendSuccessResponse(res, data);
}));

router.post("/api/news/cnn", asyncHandler(async (req, res) => {
  const data = await scrapeCNNIndonesiaNews();
  sendSuccessResponse(res, data);
}));

router.metadata = {
  name: "CNN Indonesia News",
  path: "/api/news/cnn",
  methods: ['GET', 'POST'],
  category: "NEWS",
  description: "Latest news headlines and detailed content from CNN Indonesia",
  params: [
  ],
};

module.exports = router;