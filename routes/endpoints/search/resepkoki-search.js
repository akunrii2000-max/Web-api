'use strict';

const { Router } = require('express');
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function searchResepKoki(query) {
  try {
    const searchResponse = await axios.get(`https://resepkoki.id/?s=${encodeURIComponent(query)}`, {
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    const $search = cheerio.load(searchResponse.data);
    const linkPromises = [];
    const recipes = [];

    $search("body > div.all-wrapper.with-animations > div:nth-child(5) > div > div.archive-posts.masonry-grid-w.per-row-2 > div.masonry-grid > div > article > div > div.archive-item-content > header > h3 > a")
      .each((index, element) => {
        const judul = $search(element).text();
        const link = $search(element).attr("href");
        if (link && link.startsWith("https://resepkoki.id/resep")) {
          recipes.push({ judul, link });
          linkPromises.push(axios.get(link, { timeout: 30000 }));
        }
      });

    if (linkPromises.length === 0) {
      throw new ValidationError("No recipes found", 404);
    }

    const detailResponses = await Promise.all(linkPromises);

    return detailResponses.map((response, index) => {
      const $detail = cheerio.load(response.data);

      const bahan = [];
      const takaran = [];
      const tahap = [];

      $detail("body > div.all-wrapper.with-animations > div.single-panel.os-container > div.single-panel-details > div > div.single-recipe-ingredients-nutritions > div > table > tbody > tr > td:nth-child(2) > span.ingredient-name")
        .each((a, b) => { bahan.push($detail(b).text()); });

      $detail("body > div.all-wrapper.with-animations > div.single-panel.os-container > div.single-panel-details > div > div.single-recipe-ingredients-nutritions > div > table > tbody > tr > td:nth-child(2) > span.ingredient-amount")
        .each((c, d) => { takaran.push($detail(d).text()); });

      $detail("body > div.all-wrapper.with-animations > div.single-panel.os-container > div.single-panel-main > div.single-content > div.single-steps > table > tbody > tr > td.single-step-description > div > p")
        .each((e, f) => { tahap.push($detail(f).text()); });

      const judul = $detail("body > div.all-wrapper.with-animations > div.single-panel.os-container > div.single-title.title-hide-in-desktop > h1").text();
      const waktu = $detail("body > div.all-wrapper.with-animations > div.single-panel.os-container > div.single-panel-main > div.single-meta > ul > li.single-meta-cooking-time > span").text();
      const hasil = $detail("body > div.all-wrapper.with-animations > div.single-panel.os-container > div.single-panel-main > div.single-meta > ul > li.single-meta-serves > span").text().split(": ")[1] || "";
      const level = $detail("body > div.all-wrapper.with-animations > div.single-panel.os-container > div.single-panel-main > div.single-meta > ul > li.single-meta-difficulty > span").text().split(": ")[1] || "";
      const thumb = $detail("body > div.all-wrapper.with-animations > div.single-panel.os-container > div.single-panel-details > div > div.single-main-media > img").attr("src");

      let bahanList = "";
      for (let i = 0; i < bahan.length; i++) {
        bahanList += bahan[i] + " " + takaran[i] + "\n";
      }

      let tahapList = "";
      for (let i = 0; i < tahap.length; i++) {
        tahapList += (i + 1) + ". " + tahap[i] + "\n\n";
      }

      return {
        judul,
        waktu_masak: waktu,
        hasil,
        tingkat_kesulitan: level,
        thumb,
        bahan: bahanList.trim(),
        langkah_langkah: tahapList.trim(),
        link: recipes[index].link
      };
    });
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || "Failed to search recipes", 500);
  }
}

router.get("/api/search/resep", asyncHandler(async (req, res) => {
  const { query, q } = req.query;
  const searchQuery = query || q;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await searchResepKoki(searchQuery.trim());
  sendSuccessResponse(res, {
    query: searchQuery,
    total: data.length,
    recipes: data
  });
}));

router.post("/api/search/resep", asyncHandler(async (req, res) => {
  const { query, q } = req.body;
  const searchQuery = query || q;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const data = await searchResepKoki(searchQuery.trim());
  sendSuccessResponse(res, {
    query: searchQuery,
    total: data.length,
    recipes: data
  });
}));

router.metadata = {
  name: "Resep Koki (Recipe Search)",
  path: "/api/search/resep",
  methods: ['GET', 'POST'],
  category: "SEARCH",
  description: "Search for Indonesian recipes from ResepKoki.id with detailed ingredients, steps, cooking time, and difficulty level.",
  params: [
    {
      name: "query",
      type: "text",
      required: true,
      placeholder: "nasi goreng",
      description: "Recipe search query (also accepts: q)",
    },
  ],
};

module.exports = router;