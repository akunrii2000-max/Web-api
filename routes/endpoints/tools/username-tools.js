'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

class UsernameGen {
  constructor() {
    this.headers = {
      referer: "https://usernamegenerator.com/",
      "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
    };
  }

  validate(input, fieldName) {
    if (!input) throw new ValidationError(`${fieldName} is required`, 400);
    if (!/^[a-zA-Z0-9]+$/.test(input))
      throw new ValidationError(
        `${fieldName} must contain only letters and numbers (no spaces or special characters)`,
        400
      );
    return input;
  }

  async create(keyword, { mode = "instans", theme = "action" } = {}) {
    keyword = this.validate(keyword, "Keyword");

    const conf = {
      modes: ["instans", "ai"],
      themes: [
        "action",
        "adventure",
        "fantasy",
        "historical",
        "horror",
        "mythology",
        "nature",
        "sci-fi",
        "strategy",
      ],
    };

    if (!conf.modes.includes(mode))
      throw new ValidationError(`Available modes: ${conf.modes.join(", ")}`, 400);

    if (mode === "instans") {
      const { data } = await axios.get(
        `https://usernamegenerator.com/wk/gamertags/${keyword}`,
        { headers: this.headers, timeout: 30000 }
      );
      return data;
    }

    if (!conf.themes.includes(theme))
      throw new ValidationError(`Available themes: ${conf.themes.join(", ")}`, 400);

    const { data } = await axios.post(
      "https://usernamegenerator.com/ai/generate/player-names",
      {
        genre: theme,
        keywords: keyword,
      },
      { headers: this.headers, timeout: 30000 }
    );

    return data;
  }

  async mix(name1, name2) {
    name1 = this.validate(name1, "Name1");
    name2 = this.validate(name2, "Name2");

    const { data } = await axios.get(
      `https://usernamegenerator.com/wk/mix-words/${name1}-${name2}`,
      { headers: this.headers, timeout: 30000 }
    );

    return data;
  }
}

const usernameGen = new UsernameGen();

router.get("/api/tools/username", asyncHandler(async (req, res) => {
  const { keyword, mode = "instans", theme = "action", name1, name2 } = req.query;

  let result;

  if (name1 && name2) {
    result = await usernameGen.mix(name1, name2);
    return sendSuccessResponse(res, {
      mode: "mix",
      name1,
      name2,
      usernames: result
    });
  }

  if (!keyword) {
    throw new ValidationError("Keyword is required for generator mode", 400);
  }

  result = await usernameGen.create(keyword, { mode, theme });

  sendSuccessResponse(res, {
    keyword,
    mode,
    theme: mode === "ai" ? theme : undefined,
    usernames: result
  });
}));

router.post("/api/tools/username", asyncHandler(async (req, res) => {
  const { keyword, mode = "instans", theme = "action", name1, name2 } = req.body;

  let result;

  if (name1 && name2) {
    result = await usernameGen.mix(name1, name2);
    return sendSuccessResponse(res, {
      mode: "mix",
      name1,
      name2,
      usernames: result
    });
  }

  if (!keyword) {
    throw new ValidationError("Keyword is required for generator mode", 400);
  }

  result = await usernameGen.create(keyword, { mode, theme });

  sendSuccessResponse(res, {
    keyword,
    mode,
    theme: mode === "ai" ? theme : undefined,
    usernames: result
  });
}));

router.metadata = {
  name: "Username Generator",
  path: "/api/tools/username",
  methods: ['GET', 'POST'],
  category: "TOOLS",
  description: "Generate gaming usernames instantly or using AI themes. Can also mix two names. Supports instant generation and AI-powered themed generation.",
  params: [
    {
      name: "keyword",
      type: "text",
      required: false,
      placeholder: "gamer",
      description: "Main keyword for username generator",
    },
    {
      name: "mode",
      type: "text",
      required: false,
      placeholder: "instans",
      description: "Mode: instans or ai (default: instans)",
    },
    {
      name: "theme",
      type: "text",
      required: false,
      placeholder: "fantasy",
      description: "Theme for AI mode: action, adventure, fantasy, historical, horror, mythology, nature, sci-fi, strategy",
    },
    {
      name: "name1",
      type: "text",
      required: false,
      placeholder: "john",
      description: "First name for mix mode",
    },
    {
      name: "name2",
      type: "text",
      required: false,
      placeholder: "doe",
      description: "Second name for mix mode",
    },
  ],
};

module.exports = router;