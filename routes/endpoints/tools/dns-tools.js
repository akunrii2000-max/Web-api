'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function dnsLookup(domain, dnsServer = "cloudflare") {
  try {
    const response = await axios.post(
      "https://www.nslookup.io/api/v1/records",
      { domain, dnsServer },
      {
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        timeout: 30000
      }
    );

    const result = response.data.result || response.data;

    if (!result) {
      throw new ValidationError("No DNS records found", 404);
    }

    return result;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    if (error.response) {
      throw new ValidationError(
        `DNS lookup error: ${error.response.data?.message || error.response.statusText}`,
        error.response.status
      );
    }
    throw new ValidationError(error.message || "Failed to lookup DNS records", 500);
  }
}

router.get("/api/tools/dns", asyncHandler(async (req, res) => {
  const { domain, dnsServer = "cloudflare" } = req.query;

  const validation = validate.fields({ domain }, {
    domain: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await dnsLookup(domain.trim(), dnsServer);
  sendSuccessResponse(res, {
    domain: domain.trim(),
    dns_server: dnsServer,
    records: result
  });
}));

router.post("/api/tools/dns", asyncHandler(async (req, res) => {
  const { domain, dnsServer = "cloudflare" } = req.body;

  const validation = validate.fields({ domain }, {
    domain: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await dnsLookup(domain.trim(), dnsServer);
  sendSuccessResponse(res, {
    domain: domain.trim(),
    dns_server: dnsServer,
    records: result
  });
}));

router.metadata = {
  name: "DNS Lookup",
  path: "/api/tools/dns",
  methods: ['GET', 'POST'],
  category: "TOOLS",
  description: "Look up DNS records for a domain using various DNS servers (Cloudflare, Google, etc.). Returns A, AAAA, MX, NS, TXT, and other DNS records.",
  params: [
    {
      name: "domain",
      type: "text",
      required: true,
      placeholder: "google.com",
      description: "Domain name to lookup",
    },
    {
      name: "dnsServer",
      type: "text",
      required: false,
      placeholder: "cloudflare",
      description: "DNS server to use (default: cloudflare)",
      default: "cloudflare",
      options: [
        { value: "cloudflare",    label: "☁️ Cloudflare (1.1.1.1)" },
        { value: "google",        label: "🔍 Google (8.8.8.8)" },
        { value: "quad9",         label: "🛡️ Quad9 (9.9.9.9)" },
        { value: "opendns",       label: "🌐 OpenDNS" },
        { value: "adguard",       label: "🚫 AdGuard (ad-blocking)" },
        { value: "nextdns",       label: "🔒 NextDNS" },
      ],
    },
  ],
};

module.exports = router;