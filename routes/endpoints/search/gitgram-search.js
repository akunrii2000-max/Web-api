'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function searchChords(music) {
  try {
    const searchUri = `https://www.gitagram.com/index.php?cat=&s=${encodeURIComponent(music)}`;
    const { data } = await axios.get(searchUri, {
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
    const $ = cheerio.load(data);

    let results = [];
    $("table.table tbody tr").each((index, element) => {
      let title = $(element).find("span.title.is-6").text().trim();
      let artist = $(element)
        .find("span.subtitle.is-6")
        .text()
        .replace("&#8227; ", "")
        .trim();
      let link = $(element).find("a").attr("href");
      let type = $(element).find("span.title.is-7").text().trim();

      if (title && artist && link && type) {
        results.push({ title, artist, link, type });
      }
    });

    if (results.length === 0) {
      throw new ValidationError("No chords found", 404);
    }

    return results;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || "Failed to search chords on Gitagram", 500);
  }
}

async function getChordDetail(url) {
  try {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
    const $ = cheerio.load(response.data);

    const chordsElement = $("pre[data-key]");
    const rawText = chordsElement.text();
    const lines = rawText.split("\n");

    let result = "";
    let currentSection = "";

    lines.forEach((line) => {
      const sectionMatch = line.match(/^\[([^\]]+)\]/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        result += `[${currentSection}]\n`;
        return;
      }

      const chordMatch = line.match(/^(\s*(?:\[[^\]]+\])?(?:\s*[A-G][#m]* ?)*)/);
      if (chordMatch && chordMatch[1].trim()) {
        result += line.trim() + "\n";
        return;
      }

      const cleanLyric = line.replace(/<[^>]*>/g, "").trim();
      if (cleanLyric) {
        result += cleanLyric + "\n";
      }
    });

    return result.trim();
  } catch (error) {
    throw new ValidationError(error.message || "Failed to get chord details", 500);
  }
}

router.get("/api/search/gitgram", asyncHandler(async (req, res) => {
  const { search, query, q } = req.query;
  const searchQuery = search || query || q;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const results = await searchChords(searchQuery.trim());

  const detailedResults = [];
  for (let item of results) {
    try {
      const detail = await getChordDetail(item.link);
      detailedResults.push({
        ...item,
        chords: detail
      });
    } catch (error) {
      detailedResults.push({
        ...item,
        chords: null,
        error: error.message
      });
    }
  }

  sendSuccessResponse(res, {
    query: searchQuery,
    total: detailedResults.length,
    results: detailedResults
  });
}));

router.post("/api/search/gitgram", asyncHandler(async (req, res) => {
  const { search, query, q } = req.body;
  const searchQuery = search || query || q;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const results = await searchChords(searchQuery.trim());

  const detailedResults = [];
  for (let item of results) {
    try {
      const detail = await getChordDetail(item.link);
      detailedResults.push({
        ...item,
        chords: detail
      });
    } catch (error) {
      detailedResults.push({
        ...item,
        chords: null,
        error: error.message
      });
    }
  }

  sendSuccessResponse(res, {
    query: searchQuery,
    total: detailedResults.length,
    results: detailedResults
  });
}));

router.metadata = {
  name: "Gitgram Chords Search",
  path: "/api/search/gitgram",
  methods: ['GET', 'POST'],
  category: "SEARCH",
  description: "Search for music chords on Gitagram and get detailed chord sheets with lyrics. Returns song title, artist, chord type, and full chord notation.",
  params: [
    {
      name: "search",
      type: "text",
      required: true,
      placeholder: "sekuat hatimu",
      description: "Music title or artist (also accepts: query, q)",
    },
  ],
};

module.exports = router;