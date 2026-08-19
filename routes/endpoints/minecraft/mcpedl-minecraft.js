'use strict';

const { Router } = require('express');
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

class Mcpedl {
  constructor() {
    this.baseURL = "https://mcpedl.org";
    this.is = axios.create({
      baseURL: this.baseURL,
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 16; NX729J) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7271.123 Mobile Safari/537.36",
      },
      timeout: 30000
    });
  }

  async search(query, page = 1) {
    try {
      const { data } = await this.is.get(`/page/${page}/`, {
        params: { s: query }
      });
      const $ = cheerio.load(data);
      const list = [];
      const n = $('a.next');

      $('.entries .g-grid .g-block article section').each((i, el) => {
        if ($(el).find('a').attr('href')) {
          list.push({
            name: $(el).find('h2 a').text(),
            id: $(el).find('a').attr('href').split("/").at(-2),
            img: $(el).find('img').attr('src'),
            rating: $(el).find('.rating-wrapper span').text().trim()
          });
        }
      });

      return {
        list,
        hasNextPage: !!n.attr('href'),
        nextPage: !!n.attr('href') ? n.attr('href').split("/").at(-2) : null,
      };
    } catch (err) {
      return this._handleError(err);
    }
  }

  async detail(id) {
    try {
      const r = await this.is.get(`/${id}`);
      const $ = cheerio.load(r.data);

      const [list, gallery, faq, info] = [[], [], [], {
        category: $('.categories .single-cat').text().trim(),
        postDate: $('.date').attr('content') || $('.date').text().trim(),
        author: $('.meta-author-link .author').text().trim()
      }];

      $("section#download-link table tbody tr").each((_, el) => {
        list.push({
          name: $(el).find('td:eq(1)').text(),
          nn: $(el).find('td > form').attr('action').split('/')?.[2],
        });
      });

      $('.entry-gallery div div div').each((_, el) => {
        const ty = el.attribs?.itemtype?.includes('Video') ? 'video' : 'image';
        gallery.push({
          type: ty,
          img: $(el).find('img').attr('src'),
          ...(ty == 'video' ? {
            name: $(el).find('[itemprop="name"]').attr('content') || '',
            postTime: $(el).find('[itemprop="uploadDate"]').attr('content') || '',
            duration: $(el).find('[itemprop="duration"]').attr('content') || null,
            video: $(el).find('a[itemprop="embedUrl"]').attr('onclick')?.match(/src: '(.*?)'/)?.[1] || null,
          } : {})
        });
      });

      $('#faqs div details').each((_, el) => {
        faq.push({
          question: $(el).find('summary h3').text(),
          answer: $(el).find('div p').text()
        });
      });

      $('.entry-footer-column').each((_, el) => {
        const cdiv = $(el).find('.entry-footer-content');
        let label = cdiv.find('div').first().text().trim().replace(':', '');
        let value = cdiv.find('span').last().text().trim();
        if (!label) {
          label = cdiv.contents().filter(function(){ return this.type === 'text' }).text().trim().replace(':', '');
        }
        if (label && value) {
          const key = label.toLowerCase().replace(/\s+/g, '_');
          if (!['categories', 'publication_date', 'author'].includes(key)) {
            info[key] = value;
          }
          if (label === "Author" && info.postAuthor && value !== info.postAuthor) {
            info['game_author'] = value;
          }
        }
      });

      return {
        title: $('.entry-title').text().trim(),
        img: $('.post-thumbnail img').attr('src'),
        rating: {
          count: $('span[itemprop="ratingCount"]').text(),
          value: $('span[itemprop="ratingValue"]').text(),
        },
        comment: $('span.comment-count').text(),
        content: $('section.entry-content div').text().trim(),
        info,
        gallery,
        faq,
        list: this._parseTable($)
      };
    } catch (err) {
      return this._handleError(err);
    }
  }

  async download(id) {
    try {
      const dlResponse = await this.is.get(`/dw_file.php`, {
        params: { id: id }
      });
      const $ = cheerio.load(dlResponse.data);
      return {
        url: $("a").attr("href")
      };
    } catch (err) {
      return this._handleError(err);
    }
  }

  async mclatest(page = 1) {
    try {
      const w = await this.is.get(`/downloading/page/${page}/`);
      const $ = cheerio.load(w.data);
      const [quick, list] = [[], []];

      $('.archive .dwbuttonslist div[style*="solid"]').each((i, el) => {
        if ($(el).find('a').attr('href')) {
          quick.push({
            name: $(el).find('span[style*="font-weight: 900"]').text(),
            id: $(el).find('div a').attr('href')?.replace(/\//g, ''),
            file: parseInt($(el, 10).find('form').attr('action').split('/')?.[2])
          });
        }
      });

      $('.entries .g-grid .g-block article section').each((i, el) => {
        if ($(el).find('a').attr('href')) {
          list.push({
            name: $(el).find('h2 a').text(),
            id: $(el).find('a').attr('href').split("/").at(-2),
            img: $(el).find('img').attr('src'),
            rating: $(el).find('.rating-wrapper span').text().trim()
          });
        }
      });

      return {
        quick,
        list
      };
    } catch (err) {
      return this._handleError(err);
    }
  }

  _parseTable($, rs = []) {
    $('#download-link table tbody tr').each((j, el) => {
      let [tds, nm, vr, fc, fl] = [$(el).find('td'), null, null, '', []];
      if (tds.length === 3) {
        nm = $(tds[0]).text().trim();
        vr = $(tds[1]).text().trim();
        fc = $(tds[2]);
      } else if (tds.length === 2) {
        nm = $(tds[0]).text().trim();
        vr = "N/A";
        fc = $(tds[1]);
      }
      if (fc) {
        fc.find('form').each((i, ef) => fl.push({
          index: i+1,
          type: $(ef).find('button').text().replace(/\s+/g, ' ').trim(),
          id: parseInt($(ef, 10).attr('action').split('/')?.[2]),
          meta_title: $(ef).find('input[name="post_title"]').val() || null
        }));
      }

      rs.push({
        index: j+1,
        name: nm,
        version: vr,
        files: fl
      });
    });

    return rs;
  }

  _handleError(err) {
    if (err?.response?.status === 404) {
      throw new ValidationError("Page Not Found", 404);
    }
    throw new ValidationError(err.message || "Failed to fetch from MCPEDL", 500);
  }
}

router.get("/api/minecraft/mcpedl/search", asyncHandler(async (req, res) => {
  const { q, query, search, page } = req.query;
  const searchQuery = q || query || search;
  const pageNumber = parseInt(page, 10) || 1;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const mcpedl = new Mcpedl();
  const data = await mcpedl.search(searchQuery, pageNumber);

  sendSuccessResponse(res, {
    query: searchQuery,
    page: pageNumber,
    total: data.list.length,
    hasNextPage: data.hasNextPage,
    nextPage: data.nextPage,
    results: data.list
  });
}));

router.get("/api/minecraft/mcpedl/detail", asyncHandler(async (req, res) => {
  const { id } = req.query;

  const validation = validate.fields({ id }, {
    id: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const mcpedl = new Mcpedl();
  const data = await mcpedl.detail(id);

  sendSuccessResponse(res, data);
}));

router.get("/api/minecraft/mcpedl/download", asyncHandler(async (req, res) => {
  const { id } = req.query;

  const validation = validate.fields({ id }, {
    id: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const mcpedl = new Mcpedl();
  const data = await mcpedl.download(id);

  sendSuccessResponse(res, data);
}));

router.get("/api/minecraft/mcpedl/latest", asyncHandler(async (req, res) => {
  const { page } = req.query;
  const pageNumber = parseInt(page, 10) || 1;

  const mcpedl = new Mcpedl();
  const data = await mcpedl.mclatest(pageNumber);

  sendSuccessResponse(res, {
    page: pageNumber,
    quick_downloads: data.quick,
    total_quick: data.quick.length,
    latest_mods: data.list,
    total_mods: data.list.length
  });
}));

router.post("/api/minecraft/mcpedl/search", asyncHandler(async (req, res) => {
  const { q, query, search, page } = req.body;
  const searchQuery = q || query || search;
  const pageNumber = parseInt(page, 10) || 1;

  const validation = validate.fields({ query: searchQuery }, {
    query: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const mcpedl = new Mcpedl();
  const data = await mcpedl.search(searchQuery, pageNumber);

  sendSuccessResponse(res, {
    query: searchQuery,
    page: pageNumber,
    total: data.list.length,
    hasNextPage: data.hasNextPage,
    nextPage: data.nextPage,
    results: data.list
  });
}));

router.post("/api/minecraft/mcpedl/detail", asyncHandler(async (req, res) => {
  const { id } = req.body;

  const validation = validate.fields({ id }, {
    id: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const mcpedl = new Mcpedl();
  const data = await mcpedl.detail(id);

  sendSuccessResponse(res, data);
}));

router.post("/api/minecraft/mcpedl/download", asyncHandler(async (req, res) => {
  const { id } = req.body;

  const validation = validate.fields({ id }, {
    id: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const mcpedl = new Mcpedl();
  const data = await mcpedl.download(id);

  sendSuccessResponse(res, data);
}));

router.metadata = [
  {
    name: "MCPEDL Search",
    path: "/api/minecraft/mcpedl/search",
    methods: ['GET', 'POST'],
    category: "MINECRAFT",
    description: "Search for Minecraft Pocket Edition mods, addons, maps, and resources on MCPEDL. Returns list of results with pagination support.",
    params: [
      {
        name: "q",
        type: "text",
        required: true,
        placeholder: "shader",
        description: "Search query (also accepts: query, search)",
      },
      {
        name: "page",
        type: "number",
        required: false,
        placeholder: "1",
        description: "Page number (default: 1)",
      },
    ],
  },
  {
    name: "MCPEDL Detail",
    path: "/api/minecraft/mcpedl/detail",
    methods: ['GET', 'POST'],
    category: "MINECRAFT",
    description: "Get detailed information about a specific MCPEDL mod/addon including title, description, gallery, FAQ, downloads, and ratings.",
    params: [
      {
        name: "id",
        type: "text",
        required: true,
        placeholder: "example-mod-id",
        description: "MCPEDL item ID (from search results)",
      },
    ],
  },
  {
    name: "MCPEDL Download",
    path: "/api/minecraft/mcpedl/download",
    methods: ['GET', 'POST'],
    category: "MINECRAFT",
    description: "Get direct download URL for MCPEDL mod/addon file. Provide the file ID from detail endpoint.",
    params: [
      {
        name: "id",
        type: "text",
        required: true,
        placeholder: "12345",
        description: "File ID (from detail endpoint's files array)",
      },
    ],
  },
  {
    name: "MCPEDL Latest",
    path: "/api/minecraft/mcpedl/latest",
    methods: ['GET'],
    category: "MINECRAFT",
    description: "Get latest Minecraft PE mods, addons, and resources with quick download links. Shows trending and recently uploaded content.",
    params: [
      {
        name: "page",
        type: "number",
        required: false,
        placeholder: "1",
        description: "Page number (default: 1)",
      },
    ],
  },
];

module.exports = router;