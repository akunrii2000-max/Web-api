'use strict';

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  cdn: {
    maxSize: parseInt(process.env.CDN_MAX_SIZE_MB || '100', 10) * 1024 * 1024,
  },
  store: {
    adminPass: process.env.ADMIN_PASS || 'admin123',
    adminPath: process.env.ADMIN_PATH || 'admin',
  },
};
