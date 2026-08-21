'use strict';

const { Router } = require('express');

const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

const GOOGLE_COOKIES = `# Netscape HTTP Cookie File
.gemini.google.com	TRUE	/	FALSE	1771146485	_ga	GA1.1.1119144039.1723713365
.google.com	TRUE	/	FALSE	1769954360	SID	g.a000rwgHeGZrz9y_SUE3vLuLRAXa7PXu23AI8lR26-MAZyNrYy7qsNu0SJeu7CsQtSI0V1UizAACgYKAYUSARASFQHGX2MiqjNwsRM3J-H6Qjtq4RWzrhoVAUF8yKrpTl7a6E8qpIp2obumt6mA0076
.google.com	TRUE	/	TRUE	1769954360	__Secure-1PSID	g.a000rwgHeGZrz9y_SUE3vLuLRAXa7PXu23AI8lR26-MAZyNrYy7qUdMFbWyuwMFTt-bk3Ve5awACgYKAQ4SARASFQHGX2MiYZI6LzvRvy6oikfkw1EQXxoVAUF8yKrBjPOyinpCh2hWbnxebrLx0076
.google.com	TRUE	/	TRUE	1769954360	__Secure-3PSID	g.a000rwgHeGZrz9y_SUE3vLuLRAXa7PXu23AI8lR26-MAZyNrYy7qpr5DN7XGdRxP0mZmmHaQlQACgYKAbQSARASFQHGX2MigJd5isCZCLCyWwGuBHKeTxoVAUF8yKre3I4qP1UJtMJR1I3xaw_x0076
.google.com	TRUE	/	FALSE	1769954360	HSID	AcK2pYSICr0m5vnfx
.google.com	TRUE	/	TRUE	1769954360	SSID	A6hnDJO-5GUFxInVg
.google.com	TRUE	/	FALSE	1769954360	APISID	_YUMvJaRkbLz8SDp/Aazx_-GbIamNBEqsP
.google.com	TRUE	/	TRUE	1769954360	SAPISID	CaxTa_5jC8MVeX3Y/A_wZ5nFoW6k_h0QIp
.google.com	TRUE	/	TRUE	1769954360	__Secure-1PAPISID	CaxTa_5jC8MVeX3Y/A_wZ5nFoW6k_h0QIp
.google.com	TRUE	/	TRUE	1769954360	__Secure-3PAPISID	CaxTa_5jC8MVeX3Y/A_wZ5nFoW6k_h0QIp`;

function parseCookies(cookieString) {
  const cookies = {};
  const lines = cookieString.split("\n");
  lines.forEach(line => {
    if (line.startsWith(".google.com") || line.startsWith(".gemini.google.com")) {
      const parts = line.split("\t");
      if (parts.length >= 7) {
        cookies[parts[5]] = parts[6];
      }
    }
  });
  return cookies;
}

async function extractBase64(response) {
  const lines = response.split("\n");
  for (const line of lines) {
    if (line.includes("wrb.fr") && line.includes("XqA3Ic")) {
      const jsonData = JSON.parse(line);
      const firstElement = jsonData[0];
      const base64String = firstElement[2];
      return base64String.replace(/^"/, "").replace(/"$/, "").replace(/\\"/g, "").trim();
    }
  }
  throw new Error("Base64 data not found in response");
}

async function getGeminiToken() {
  const cookies = parseCookies(GOOGLE_COOKIES);
  const cookieString = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");

  const axios = (await import("axios")).default;
  const bardRes = await axios.get("https://gemini.google.com/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Cookie": cookieString
    },
    timeout: 30000
  });

  const bardText = bardRes.data;
  const tokens = { at: null, sid: null };

  const atMatch = bardText.match(/"FdrFJe":"([^"]+)"/);
  if (atMatch) tokens.sid = atMatch[1];

  const SNlM0eMatch = bardText.match(/"SNlM0e":"([^"]+)"/);
  if (SNlM0eMatch) tokens.at = SNlM0eMatch[1];

  return tokens;
}

async function makeGeminiRequest(query, language) {
  const cookies = parseCookies(GOOGLE_COOKIES);
  const cookieString = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");

  const url = "https://gemini.google.com/_/BardChatUi/data/batchexecute";
  const tokens = await getGeminiToken();

  const params = {
    rpcids: "XqA3Ic",
    "source-path": "/app",
    bl: "boq_assistant-bard-web-server_20250226.06_p2",
    "f.sid": tokens.sid,
    hl: "id",
    "_reqid": "1951413",
    rt: "c"
  };

  const headers = {
    "authority": "gemini.google.com",
    "accept": "*/*",
    "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    "origin": "https://gemini.google.com",
    "referer": "https://gemini.google.com/",
    "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36",
    Cookie: cookieString
  };

  const message = query.replace(/\n/g, "\\\\n");
  const axios = (await import("axios")).default;
  const { URLSearchParams } = await import("url");

  const data = new URLSearchParams();
  data.append("f.req", `[[["XqA3Ic","[null,\\"${message}\\",\\"${language}\\",null,2]",null,"generic"]]]`);
  data.append("at", tokens.at);

  const response = await axios.post(url, data.toString(), { params, headers, timeout: 30000 });
  return response.data;
}

async function getGoogleTTSAudio(query, language = "ja-JP") {
  const result = await makeGeminiRequest(query, language);
  return await extractBase64(result);
}

router.get("/api/tools/tts-google", asyncHandler(async (req, res) => {
  const { text, language = "ja-JP" } = req.query;

  if (!text) {
    throw new ValidationError("Text parameter is required", 400);
  }

  if (text.length > 1000) {
    throw new ValidationError("Text must not exceed 1000 characters", 400);
  }

  const base64Audio = await getGoogleTTSAudio(text.trim(), language.trim());

  if (!base64Audio) {
    throw new ValidationError("Failed to generate audio", 500);
  }

  const audioBuffer = Buffer.from(base64Audio, "base64");

  res.set("Content-Type", "audio/mpeg");
  res.set("Content-Length", audioBuffer.length);
  res.set("Cache-Control", "public, max-age=3600");
  res.set("Content-Disposition", `inline; filename="tts_${Date.now()}.mp3"`);
  res.send(audioBuffer);
}));

router.post("/api/tools/tts-google", asyncHandler(async (req, res) => {
  const { text, language = "ja-JP" } = req.body;

  if (!text) {
    throw new ValidationError("Text parameter is required", 400);
  }

  if (text.length > 1000) {
    throw new ValidationError("Text must not exceed 1000 characters", 400);
  }

  const base64Audio = await getGoogleTTSAudio(text.trim(), language.trim());

  if (!base64Audio) {
    throw new ValidationError("Failed to generate audio", 500);
  }

  const audioBuffer = Buffer.from(base64Audio, "base64");

  res.set("Content-Type", "audio/mpeg");
  res.set("Content-Length", audioBuffer.length);
  res.set("Cache-Control", "public, max-age=3600");
  res.set("Content-Disposition", `inline; filename="tts_${Date.now()}.mp3"`);
  res.send(audioBuffer);
}));

router.metadata = [

  {
    name: "TTS Google (Gemini)",
    path: "/api/tools/tts-google",
    methods: ['GET', 'POST'],
    category: "TOOLS",
    description: "Convert text to speech using Google TTS powered by Gemini infrastructure. Returns MP3 audio file.",
    params: [
      {
        name: "text",
        type: "text",
        required: true,
        placeholder: "halo semua, apa kabar?",
        description: "Text to convert to speech (max 1000 characters)",
      },
      {
        name: "language",
        type: "text",
        required: false,
        placeholder: "ja-JP",
        description: "Language code (default: ja-JP for Japanese)",
        default: "ja-JP",
        options: [
          { value: "ja-JP", label: "🇯🇵 Japanese (ja-JP)" },
          { value: "id-ID", label: "🇮🇩 Indonesian (id-ID)" },
          { value: "en-US", label: "🇺🇸 English US (en-US)" },
          { value: "en-GB", label: "🇬🇧 English UK (en-GB)" },
          { value: "ko-KR", label: "🇰🇷 Korean (ko-KR)" },
          { value: "zh-CN", label: "🇨🇳 Chinese (zh-CN)" },
          { value: "zh-TW", label: "🇹🇼 Chinese TW (zh-TW)" },
          { value: "fr-FR", label: "🇫🇷 French (fr-FR)" },
          { value: "de-DE", label: "🇩🇪 German (de-DE)" },
          { value: "es-ES", label: "🇪🇸 Spanish (es-ES)" },
          { value: "pt-BR", label: "🇧🇷 Portuguese BR (pt-BR)" },
          { value: "ar-XA", label: "🇸🇦 Arabic (ar-XA)" },
          { value: "hi-IN", label: "🇮🇳 Hindi (hi-IN)" },
          { value: "ru-RU", label: "🇷🇺 Russian (ru-RU)" },
          { value: "tr-TR", label: "🇹🇷 Turkish (tr-TR)" },
          { value: "th-TH", label: "🇹🇭 Thai (th-TH)" },
          { value: "vi-VN", label: "🇻🇳 Vietnamese (vi-VN)" },
        ],
      },
    ],
  },
];

module.exports = router;