'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

class GitHubDependentsScraper {
  constructor(githubUrl, begin, end) {
    this.headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      TE: "Trailers",
    };

    this.githubUrl = githubUrl;
    this.begin = begin;
    this.end = end;
    this.uri = this.convertToDependentsUrl(githubUrl);
    this.allResults = [];
  }

  convertToDependentsUrl(githubUrl) {
    const regex = /https:\/\/github\.com\/([^/]+)\/([^/]+)/;
    const match = githubUrl.match(regex);
    if (match) {
      const packageAuthor = match[1];
      const packageName = match[2];
      return `https://github.com/${packageAuthor}/${packageName}/network/dependents`;
    } else {
      throw new ValidationError("Invalid GitHub URL", 400);
    }
  }

  extractDataFromHtml($) {
    const jsonData = [];

    $('div.Box-row[data-test-id="dg-repo-pkg-dependent"]').each(
      (index, element) => {
        const username = $(element)
          .find('a[data-hovercard-type="user"]')
          .text()
          .trim();
        const avatarUrl = $(element).find("img.avatar").attr("src");
        const repoName = $(element)
          .find('a[data-hovercard-type="repository"]')
          .text()
          .trim();
        const repoUrl = `https://github.com/${username}/${repoName}`;
        const stars =
          parseInt(
            $(element, 10).find("svg.octicon-star").parent().text().trim(),
            10
          ) || 0;
        const forks =
          parseInt(
            $(element, 10)
              .find("svg.octicon-repo-forked")
              .parent()
              .text()
              .trim(),
            10
          ) || 0;

        jsonData.push({
          user: { username, avatar_url: avatarUrl },
          repository: { name: repoName, url: repoUrl },
          stars,
          forks,
        });
      }
    );

    return jsonData;
  }

  async fetchPage(uri, pageIndex) {
    try {
      const response = await axios.get(uri, {
        headers: this.headers,
        timeout: 30000
      });
      const $ = cheerio.load(response.data);

      const pageData = this.extractDataFromHtml($);
      this.allResults.push(...pageData);

      return {
        html: response.data,
        data: pageData,
      };
    } catch (error) {
      throw new ValidationError(`Failed to fetch page ${pageIndex + 1}: ${error.message}`, 500);
    }
  }

  getPaginationUri(html) {
    const $ = cheerio.load(html);
    const paginationLink = $(
      'div.BtnGroup[data-test-selector="pagination"] a'
    )
      .last()
      .attr("href");
    return paginationLink ? `https://github.com${paginationLink}` : null;
  }

  async getJsons() {
    let currentUri = this.uri;
    let currentPage = this.begin;
    let totalItems = 0;

    while (currentPage < this.end) {
      const result = await this.fetchPage(currentUri, currentPage);
      if (!result) break;

      const nextUri = this.getPaginationUri(result.html);
      if (!nextUri) break;

      currentUri = nextUri;
      currentPage++;
      totalItems += result.data.length;
    }

    return {
      total: totalItems,
      pages_scraped: currentPage - this.begin + 1,
      dependents: this.allResults,
    };
  }
}

async function scrapeGitHubDependents(url, begin, end) {
  try {
    const scraper = new GitHubDependentsScraper(
      url,
      parseInt(begin.toString()),
      parseInt(end.toString())
    );
    return await scraper.getJsons();
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(error.message || "Failed to scrape GitHub dependents", 500);
  }
}

router.get("/api/search/github-dependents", asyncHandler(async (req, res) => {
  const { url, begin = "0", end = "2" } = req.query;

  const validation = validate.fields({ url }, {
    url: { required: true, type: "url", domain: "github.com" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const parsedBegin = parseInt(begin, 10);
  const parsedEnd = parseInt(end, 10);

  if (isNaN(parsedBegin) || parsedBegin < 0 || parsedBegin > 100) {
    throw new ValidationError("Begin page must be between 0 and 100", 400);
  }

  if (isNaN(parsedEnd) || parsedEnd < 1 || parsedEnd > 100) {
    throw new ValidationError("End page must be between 1 and 100", 400);
  }

  if (parsedBegin > parsedEnd) {
    throw new ValidationError("Begin page cannot be greater than end page", 400);
  }

  const results = await scrapeGitHubDependents(url.trim(), parsedBegin, parsedEnd);

  sendSuccessResponse(res, {
    repository_url: url,
    ...results
  });
}));

router.post("/api/search/github-dependents", asyncHandler(async (req, res) => {
  const { url, begin = "0", end = "2" } = req.body;

  const validation = validate.fields({ url }, {
    url: { required: true, type: "url", domain: "github.com" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const parsedBegin = parseInt(begin, 10);
  const parsedEnd = parseInt(end, 10);

  if (isNaN(parsedBegin) || parsedBegin < 0 || parsedBegin > 100) {
    throw new ValidationError("Begin page must be between 0 and 100", 400);
  }

  if (isNaN(parsedEnd) || parsedEnd < 1 || parsedEnd > 100) {
    throw new ValidationError("End page must be between 1 and 100", 400);
  }

  if (parsedBegin > parsedEnd) {
    throw new ValidationError("Begin page cannot be greater than end page", 400);
  }

  const results = await scrapeGitHubDependents(url.trim(), parsedBegin, parsedEnd);

  sendSuccessResponse(res, {
    repository_url: url,
    ...results
  });
}));

router.metadata = {
  name: "GitHub Repository Dependents",
  path: "/api/search/github-dependents",
  methods: ['GET', 'POST'],
  category: "SEARCH",
  description: "Scrape GitHub repository dependents with pagination support. Returns user info, repository details, stars, and forks for each dependent.",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://github.com/user/repo",
      description: "GitHub repository URL",
    },
    {
      name: "begin",
      type: "number",
      required: false,
      placeholder: "0",
      description: "Starting page for scraping (default: 0, max: 100)",
    },
    {
      name: "end",
      type: "number",
      required: false,
      placeholder: "2",
      description: "Ending page for scraping (default: 2, max: 100)",
    },
  ],
};

module.exports = router;