'use strict';

const { Router } = require('express');
const https = require('https');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

const getInitialAuth = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'id.pinterest.com',
      path: '/',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      },
    };

    https.get(options, (res) => {
      const cookies = res.headers['set-cookie'];
      if (cookies) {
        const csrfCookie = cookies.find(cookie => cookie.startsWith('csrftoken='));
        const pinterestSessCookie = cookies.find(cookie => cookie.startsWith('_pinterest_sess='));

        if (csrfCookie && pinterestSessCookie) {
          const csrftoken = csrfCookie.split(';')[0].split('=')[1];
          const sess = pinterestSessCookie.split(';')[0];
          resolve({ csrftoken, cookieHeader: `csrftoken=${csrftoken}; ${sess}` });
          return;
        }
      }
      reject(new Error('Failed to get CSRF token or session cookie'));
    }).on('error', e => reject(e));
  });
};

const searchPinterestAPI = async (query, limit) => {
  try {
    const { csrftoken, cookieHeader } = await getInitialAuth();
    let results = [];
    let bookmark = null;
    let keepFetching = true;

    while (keepFetching && results.length < limit) {
      const postData = {
        options: {
          query: query,
          scope: 'pins',
          bookmarks: bookmark ? [bookmark] : [],
        },
        context: {},
      };

      const sourceUrl = `/search/pins/?q=${encodeURIComponent(query)}`;
      const dataString = `source_url=${encodeURIComponent(sourceUrl)}&data=${encodeURIComponent(JSON.stringify(postData))}`;

      const options = {
        hostname: 'id.pinterest.com',
        path: '/resource/BaseSearchResource/get/',
        method: 'POST',
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRFToken': csrftoken,
          'X-Pinterest-Source-Url': sourceUrl,
          'Cookie': cookieHeader,
        },
      };

      const responseBody = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let body = '';
          res.on('data', chunk => (body += chunk));
          res.on('end', () => resolve(body));
        });
        req.on('error', e => reject(e));
        req.write(dataString);
        req.end();
      });

      const jsonResponse = JSON.parse(responseBody);

      if (jsonResponse.resource_response && jsonResponse.resource_response.data && jsonResponse.resource_response.data.results) {
        const pins = jsonResponse.resource_response.data.results;

        pins.forEach(pin => {
          if (pin.images && pin.images['736x']) {
            results.push(pin.images['736x'].url);
          } else if (pin.images && pin.images['orig']) {
            results.push(pin.images['orig'].url);
          }
        });

        bookmark = jsonResponse.resource_response.bookmark;
        if (!bookmark || pins.length === 0) {
          keepFetching = false;
        }
      } else {
        keepFetching = false;
      }
    }

    return results.slice(0, limit);

  } catch (error) {
    throw new ValidationError(`Pinterest search error: ${error.message}`, 500);
  }
};

router.get("/api/search/pinterest", asyncHandler(async (req, res) => {
  const { query, limit = 10 } = req.query;

  if (!validate.notEmpty(query)) {
    throw new ValidationError("Query is required", 400);
  }

  const limitNum = parseInt(limit, 10);
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
    throw new ValidationError("Limit must be between 1 and 50", 400);
  }

  const results = await searchPinterestAPI(query.trim(), limitNum);

  sendSuccessResponse(res, {
    query: query.trim(),
    count: results.length,
    results: results
  });
}));

router.post("/api/search/pinterest", asyncHandler(async (req, res) => {
  const { query, limit = 10 } = req.body;

  if (!validate.notEmpty(query)) {
    throw new ValidationError("Query is required", 400);
  }

  const limitNum = parseInt(limit, 10);
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
    throw new ValidationError("Limit must be between 1 and 50", 400);
  }

  const results = await searchPinterestAPI(query.trim(), limitNum);

  sendSuccessResponse(res, {
    query: query.trim(),
    count: results.length,
    results: results
  });
}));

router.metadata = {
  name: "Pinterest Search",
  path: "/api/search/pinterest",
  methods: ['GET', 'POST'],
  category: "SEARCH",
  description: "Search images on Pinterest with customizable limit. Returns direct image URLs.",
  params: [
    {
      name: "query",
      type: "text",
      required: true,
      placeholder: "cute cats",
      description: "Search query",
    },
    {
      name: "limit",
      type: "number",
      required: false,
      placeholder: "10",
      description: "Number of results (1-50, default: 10)",
    },
  ],
};

module.exports = router;