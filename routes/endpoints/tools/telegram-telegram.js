'use strict';

const { Router } = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

class TelegramChannel {
  constructor(channelUsername, options = {}) {
    this.channelUsername = channelUsername;
    this.baseUrl = "https://t.me";
    this.options = {
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 2000,
      requestTimeout: options.requestTimeout || 30000,
      ...options,
    };
  }

  async retryRequest(requestFn, attempts = this.options.retryAttempts) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await requestFn();
      } catch (error) {
        if (i === attempts - 1) throw error;
        console.log(`Retry ${i + 1}/${attempts} after error: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, this.options.retryDelay));
      }
    }
  }

  async fetchChannelPage(beforeId = null) {
    return this.retryRequest(async () => {
      const url = beforeId
        ? `${this.baseUrl}/s/${this.channelUsername}?before=${beforeId}`
        : `${this.baseUrl}/s/${this.channelUsername}`;

      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
        },
        timeout: this.options.requestTimeout,
      });

      return response.data;
    });
  }

  parseMessage($, element) {
    const $msg = $(element);

    const textElement = $msg.find(".tgme_widget_message_text.js-message_text").first();
    const text = textElement.text().trim();
    const htmlText = textElement.html() ? textElement.html().trim() : "";

    const links = [];
    textElement.find("a").each((i, el) => {
      const href = $(el).attr("href");
      const linkText = $(el).text().trim();
      if (href) {
        links.push({
          url: href,
          text: linkText,
          target: $(el).attr("target"),
          rel: $(el).attr("rel"),
        });
      }
    });

    const views = $msg.find(".tgme_widget_message_views").text().trim();
    const dateElement = $msg.find(".tgme_widget_message_date");
    const messageUrl = dateElement.attr("href");
    const datetime = dateElement.find("time").attr("datetime");
    const timeText = dateElement.find("time").text().trim();

    const messageId = messageUrl ? messageUrl.split("/").pop() : null;
    const authorName = $msg.find(".tgme_widget_message_author_name").first().text().trim();
    const author = authorName || null;

    const hasPhoto = $msg.find(".tgme_widget_message_photo_wrap").length > 0;
    const hasVideo = $msg.find(".tgme_widget_message_video_wrap").length > 0 || $msg.find(".tgme_widget_message_video_player").length > 0;
    const hasDocument = $msg.find(".tgme_widget_message_document").length > 0 || $msg.find(".tgme_widget_message_document_wrap").length > 0;

    let photoInfo = null;
    if (hasPhoto) {
      const photoWrap = $msg.find(".tgme_widget_message_photo_wrap");
      const style = photoWrap.attr("style");

      const urlMatch = style?.match(/background-image:url\('(.+?)'\)/);
      const photoUrl = urlMatch ? urlMatch[1] : null;

      const widthMatch = style?.match(/width:(\d+)px/);
      const width = widthMatch ? parseInt(widthMatch[1], 10) : null;

      const photoInner = $msg.find(".tgme_widget_message_photo");
      const innerStyle = photoInner.attr("style");
      const paddingMatch = innerStyle?.match(/padding-top:([\d.]+)%/);
      const aspectRatio = paddingMatch ? parseFloat(paddingMatch[1]) : null;

      let height = null;
      if (width && aspectRatio) {
        height = Math.round((width * aspectRatio) / 100);
      }

      const photoLink = photoWrap.attr("href");
      const photoClasses = photoWrap.attr("class");

      photoInfo = {
        url: photoUrl,
        width,
        height,
        aspectRatio,
        link: photoLink,
        classes: photoClasses,
      };
    }

    let videoInfo = null;
    if (hasVideo) {
      const videoPlayerLink = $msg.find(".tgme_widget_message_video_player").attr("href");

      const thumbStyle = $msg.find(".tgme_widget_message_video_thumb").attr("style");
      const thumbMatch = thumbStyle?.match(/background-image:url\('(.+?)'\)/);
      const thumbnail = thumbMatch ? thumbMatch[1] : null;

      const videoSrc = $msg.find(".tgme_widget_message_video").attr("src") || $msg.find("video").attr("src");

      const duration = $msg.find(".message_video_duration").text().trim();

      const wrapStyle = $msg.find(".tgme_widget_message_video_wrap").attr("style");
      let width = null;
      let height = null;
      let aspectRatio = null;

      if (wrapStyle) {
        const widthMatch = wrapStyle.match(/width:(\d+)px/);
        const paddingMatch = wrapStyle.match(/padding-top:([\d.]+)%/);

        if (widthMatch) width = parseInt(widthMatch[1], 10);
        if (paddingMatch) {
          aspectRatio = parseFloat(paddingMatch[1]);
          if (width) height = Math.round((width * aspectRatio) / 100);
        }
      }

      videoInfo = {
        thumbnail,
        videoUrl: videoSrc,
        duration,
        width,
        height,
        aspectRatio,
        playerLink: videoPlayerLink,
      };
    }

    let documentInfo = null;
    if (hasDocument) {
      const docLink = $msg.find(".tgme_widget_message_document_wrap").attr("href");
      const docTitle = $msg.find(".tgme_widget_message_document_title").text().trim();
      const docSize = $msg.find(".tgme_widget_message_document_extra").text().trim();

      const fileExt = docTitle.includes(".") ? docTitle.split(".").pop().toLowerCase() : "unknown";

      documentInfo = {
        title: docTitle,
        size: docSize,
        fileExtension: fileExt,
        downloadLink: docLink,
      };
    }

    const forwardAuthor = $msg.find(".tgme_widget_message_forwarded_from_name").text().trim();
    const forwardFrom = forwardAuthor || null;

    const replyElement = $msg.find(".tgme_widget_message_reply");
    let replyTo = null;
    if (replyElement.length > 0) {
      const replyAuthor = replyElement.find(".tgme_widget_message_author_name").text().trim();
      const replyText = replyElement.find(".tgme_widget_message_text").text().trim();
      replyTo = {
        author: replyAuthor,
        text: replyText,
      };
    }

    return {
      messageId,
      text,
      htmlText,
      links,
      author,
      views: views || "0",
      datetime,
      timeText,
      messageUrl,
      media: {
        hasPhoto,
        hasVideo,
        hasDocument,
        photoInfo,
        videoInfo,
        documentInfo,
      },
      forwardFrom,
      replyTo,
    };
  }

  async getChannelInfo() {
    const html = await this.fetchChannelPage();
    const $ = cheerio.load(html);

    const titleElement = $(".tgme_channel_info_header_title span");
    let title = titleElement.html() || "";
    title = this.decodeHtmlEntities(title);

    const username = $(".tgme_channel_info_header_username a").text().trim();
    const description = $(".tgme_channel_info_description").text().trim();

    let photoUrl = null;
    const photoImg = $(".tgme_page_photo_image img");
    if (photoImg.length > 0) {
      photoUrl = photoImg.attr("src");
    } else {
      const photoStyle = $(".tgme_page_photo_image").attr("style");
      if (photoStyle) {
        const match = photoStyle.match(/background-image:url\('(.+?)'\)/);
        photoUrl = match ? match[1] : null;
      }
    }

    const photoInitials = $(".tgme_page_photo_image").attr("data-content");

    const labels = [];
    $(".tgme_channel_info_header_labels .tgme_label").each((i, el) => {
      labels.push($(el).text().trim());
    });

    const counters = {
      subscribers: 0,
      photos: 0,
      videos: 0,
      files: 0,
      links: 0,
    };

    $(".tgme_channel_info_counters .tgme_channel_info_counter").each((i, el) => {
      const value = $(el).find(".counter_value").text().trim();
      const type = $(el).find(".counter_type").text().trim().toLowerCase();

      if (type && value) {
        const numValue = this.parseCounterValue(value);
        counters[type] = numValue;
      }
    });

    return {
      title,
      username,
      description,
      photoUrl,
      photoInitials,
      labels,
      counters,
      channelUrl: `${this.baseUrl}/${this.channelUsername}`,
      webUrl: `${this.baseUrl}/s/${this.channelUsername}`,
    };
  }

  async getMessages(limit = 20) {
    const html = await this.fetchChannelPage();
    const $ = cheerio.load(html);
    const messages = [];

    $(".tgme_widget_message").each((i, element) => {
      if (limit && messages.length >= limit) return false;

      const message = this.parseMessage($, element);
      messages.push(message);
    });

    return messages;
  }

  async getAllMessages(limit = null) {
    let allMessages = [];
    const messageIds = new Set();
    let offsetId = 0;
    let hasMore = true;

    while (hasMore) {
      const url = offsetId > 0 ? `${this.baseUrl}/s/${this.channelUsername}?before=${offsetId}` : `${this.baseUrl}/s/${this.channelUsername}`;

      try {
        const response = await axios.get(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
          },
          timeout: 30000,
        });

        const $ = cheerio.load(response.data);
        const messages = [];
        let newCount = 0;

        $(".tgme_widget_message_wrap, .tgme_widget_message").each((i, element) => {
          try {
            const messageData = this.parseMessage($, $(element));
            if (messageData && messageData.messageId) {
              if (!messageIds.has(messageData.messageId)) {
                messages.push(messageData);
                messageIds.add(messageData.messageId);
                newCount++;
              }
            }
          } catch (err) {
            console.error("Error parsing message:", err.message);
          }
        });

        if (newCount === 0) {
          hasMore = false;
          break;
        }

        allMessages = allMessages.concat(messages);

        if (limit && allMessages.length >= limit) {
          allMessages = allMessages.slice(0, limit);
          hasMore = false;
          break;
        }

        const lastMessage = messages[messages.length - 1];
        const newOffsetId = parseInt(lastMessage.messageId, 10);

        if (newOffsetId === offsetId || isNaN(newOffsetId)) {
          hasMore = false;
          break;
        }

        offsetId = newOffsetId;

        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        if (error.response?.status === 404) {
          hasMore = false;
        } else {
          throw error;
        }
      }
    }

    return allMessages;
  }

  decodeHtmlEntities(text) {
    const entities = {
      "&#33;": "!",
      "&#34;": '"',
      "&#35;": "#",
      "&#36;": "$",
      "&#37;": "%",
      "&#38;": "&",
      "&#39;": "'",
      "&#40;": "(",
      "&#41;": ")",
      "&#42;": "*",
      "&#43;": "+",
      "&#44;": ",",
      "&#45;": "-",
      "&#46;": ".",
      "&#47;": "/",
      "&quot;": '"',
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&nbsp;": " ",
    };

    let decoded = text;

    for (const [entity, char] of Object.entries(entities)) {
      decoded = decoded.split(entity).join(char);
    }

    decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
      return String.fromCharCode(dec);
    });

    decoded = decoded.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    return decoded;
  }

  parseCounterValue(value) {
    value = value.trim().toUpperCase();

    if (value.endsWith("K")) {
      return parseFloat(value) * 1000;
    } else if (value.endsWith("M")) {
      return parseFloat(value) * 1000000;
    } else if (value.endsWith("B")) {
      return parseFloat(value) * 1000000000;
    }

    return parseInt(value, 10) || 0;
  }

  filterMessages(messages, filters = {}) {
    let filtered = [...messages];

    if (filters.hasVideo) {
      filtered = filtered.filter((m) => m.media.hasVideo);
    }

    if (filters.hasPhoto) {
      filtered = filtered.filter((m) => m.media.hasPhoto);
    }

    if (filters.hasDocument) {
      filtered = filtered.filter((m) => m.media.hasDocument);
    }

    if (filters.keyword) {
      filtered = filtered.filter((m) => m.text.toLowerCase().includes(filters.keyword.toLowerCase()));
    }

    if (filters.author) {
      filtered = filtered.filter((m) => m.author === filters.author);
    }

    if (filters.minViews) {
      filtered = filtered.filter((m) => this.parseCounterValue(m.views) >= filters.minViews);
    }

    return filtered;
  }
}

router.get("/api/telegram/channel/info", asyncHandler(async (req, res) => {
  const { username } = req.query;

  const validation = validate.fields({ username }, {
    username: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const scraper = new TelegramChannel(username);
  const data = await scraper.getChannelInfo();

  sendSuccessResponse(res, data);
}));

router.get("/api/telegram/channel/messages", asyncHandler(async (req, res) => {
  const { username, limit } = req.query;

  const validation = validate.fields({ username }, {
    username: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const messageLimit = limit ? parseInt(limit, 10) : 20;
  const scraper = new TelegramChannel(username);
  const data = await scraper.getMessages(messageLimit);

  sendSuccessResponse(res, {
    total: data.length,
    messages: data,
  });
}));

router.get("/api/telegram/channel/all-messages", asyncHandler(async (req, res) => {
  const { username, limit } = req.query;

  const validation = validate.fields({ username }, {
    username: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const messageLimit = limit ? parseInt(limit, 10) : null;
  const scraper = new TelegramChannel(username);
  const data = await scraper.getAllMessages(messageLimit);

  sendSuccessResponse(res, {
    total: data.length,
    messages: data,
  });
}));

router.get("/api/telegram/channel/filter", asyncHandler(async (req, res) => {
  const { username, limit, hasVideo, hasPhoto, hasDocument, keyword, author, minViews } = req.query;

  const validation = validate.fields({ username }, {
    username: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const messageLimit = limit ? parseInt(limit, 10) : 20;
  const scraper = new TelegramChannel(username);
  const allMessages = await scraper.getMessages(messageLimit);

  const filters = {
    hasVideo: hasVideo === "true",
    hasPhoto: hasPhoto === "true",
    hasDocument: hasDocument === "true",
    keyword: keyword || null,
    author: author || null,
    minViews: minViews ? parseInt(minViews, 10) : null,
  };

  const filtered = scraper.filterMessages(allMessages, filters);

  sendSuccessResponse(res, {
    total: filtered.length,
    filters: filters,
    messages: filtered,
  });
}));

router.post("/api/telegram/channel/info", asyncHandler(async (req, res) => {
  const { username } = req.body;

  const validation = validate.fields({ username }, {
    username: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const scraper = new TelegramChannel(username);
  const data = await scraper.getChannelInfo();

  sendSuccessResponse(res, data);
}));

router.post("/api/telegram/channel/messages", asyncHandler(async (req, res) => {
  const { username, limit } = req.body;

  const validation = validate.fields({ username }, {
    username: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const messageLimit = limit ? parseInt(limit, 10) : 20;
  const scraper = new TelegramChannel(username);
  const data = await scraper.getMessages(messageLimit);

  sendSuccessResponse(res, {
    total: data.length,
    messages: data,
  });
}));

router.metadata = [
  {
    name: "Telegram Channel Info",
    path: "/api/telegram/channel/info",
    methods: ['GET', 'POST'],
    category: "TELEGRAM",
    description: "Get information about a Telegram channel (title, description, photo, subscribers, etc.)",
    params: [
      {
        name: "username",
        type: "text",
        required: true,
        placeholder: "hanzyy001",
        description: "Telegram channel username (without @)",
      },
    ],
  },
  {
    name: "Telegram Channel Messages",
    path: "/api/telegram/channel/messages",
    methods: ['GET', 'POST'],
    category: "TELEGRAM",
    description: "Get recent messages from a Telegram channel (default: 20 messages)",
    params: [
      {
        name: "username",
        type: "text",
        required: true,
        placeholder: "hanzyy001",
        description: "Telegram channel username (without @)",
      },
      {
        name: "limit",
        type: "number",
        required: false,
        placeholder: "20",
        description: "Number of messages to fetch (default: 20)",
      },
    ],
  },
  {
    name: "Telegram Channel All Messages",
    path: "/api/telegram/channel/all-messages",
    methods: ['GET'],
    category: "TELEGRAM",
    description: "Get all messages from a Telegram channel with pagination (can take longer)",
    params: [
      {
        name: "username",
        type: "text",
        required: true,
        placeholder: "hanzyy001",
        description: "Telegram channel username (without @)",
      },
      {
        name: "limit",
        type: "number",
        required: false,
        placeholder: "100",
        description: "Maximum number of messages to fetch (optional)",
      },
    ],
  },
  {
    name: "Telegram Channel Filter Messages",
    path: "/api/telegram/channel/filter",
    methods: ['GET'],
    category: "TELEGRAM",
    description: "Filter Telegram channel messages by media type, keyword, author, or minimum views",
    params: [
      {
        name: "username",
        type: "text",
        required: true,
        placeholder: "hanzyy001",
        description: "Telegram channel username (without @)",
      },
      {
        name: "limit",
        type: "number",
        required: false,
        placeholder: "20",
        description: "Number of messages to fetch before filtering",
      },
      {
        name: "hasVideo",
        type: "boolean",
        required: false,
        placeholder: "true",
        description: "Filter only messages with video",
      },
      {
        name: "hasPhoto",
        type: "boolean",
        required: false,
        placeholder: "true",
        description: "Filter only messages with photo",
      },
      {
        name: "hasDocument",
        type: "boolean",
        required: false,
        placeholder: "true",
        description: "Filter only messages with document",
      },
      {
        name: "keyword",
        type: "text",
        required: false,
        placeholder: "search term",
        description: "Filter messages containing keyword",
      },
      {
        name: "author",
        type: "text",
        required: false,
        placeholder: "Author Name",
        description: "Filter messages by author name",
      },
      {
        name: "minViews",
        type: "number",
        required: false,
        placeholder: "1000",
        description: "Filter messages with minimum views",
      },
    ],
  },
];

module.exports = router;