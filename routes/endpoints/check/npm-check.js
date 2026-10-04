'use strict';

const { Router } = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

async function checkNPMPackage(packageName) {
  try {
    const response = await axios.get(`https://registry.npmjs.org/${packageName}`, {
      timeout: 30000,
    });

    const versions = response.data.versions;
    const allVer = Object.keys(versions);
    const verLatest = allVer[allVer.length - 1];
    const verPublish = allVer[0];
    const packageLatest = versions[verLatest];

    return {
      name: packageName,
      versionLatest: verLatest,
      versionPublish: verPublish,
      versionUpdate: allVer.length,
      latestDependencies: Object.keys(packageLatest.dependencies || {}).length,
      publishDependencies: Object.keys(versions[verPublish].dependencies || {}).length,
      publishTime: response.data.time.created,
      latestPublishTime: response.data.time[verLatest],
    };
  } catch (error) {
    if (error.response?.status === 404) {
      throw new ValidationError(`Package "${packageName}" not found on NPM`, 404);
    }
    throw new ValidationError(error.message || "Failed to check NPM package", 500);
  }
}

router.get("/api/check/npm", asyncHandler(async (req, res) => {
  const { packageName, q, search } = req.query;
  const pkg = packageName || q || search;

  const validation = validate.fields({ package: pkg }, {
    package: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await checkNPMPackage(pkg.trim());

  sendSuccessResponse(res, {
    package_name: pkg,
    ...result
  });
}));

router.post("/api/check/npm", asyncHandler(async (req, res) => {
  const { packageName, q, search } = req.body;
  const pkg = packageName || q || search;

  const validation = validate.fields({ package: pkg }, {
    package: { required: true, type: "string" },
  });

  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(", "), 400);
  }

  const result = await checkNPMPackage(pkg.trim());

  sendSuccessResponse(res, {
    package_name: pkg,
    ...result
  });
}));

router.metadata = {
  name: "NPM Package Check",
  path: "/api/check/npm",
  methods: ['GET', 'POST'],
  category: "CHECK",
  description: "Check NPM package information including version history, dependencies, and publication details. Returns latest version, initial version, total updates, dependency counts, and timestamps.",
  params: [
    {
      name: "packageName",
      type: "text",
      required: true,
      placeholder: "axios",
      description: "NPM package name (also accepts: q, search)",
    },
  ],
};

module.exports = router;