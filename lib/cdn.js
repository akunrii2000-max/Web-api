'use strict';

/**
 * Pemilih backend CDN.
 *   CDN_MODE=local (default) → lib/cdn-local.js    — file disimpan di disk
 *   CDN_MODE=external        → lib/cdn-external.js — DongtubeDB via REST
 */
module.exports = (process.env.CDN_MODE || 'local') === 'external'
  ? require('./cdn-external')
  : require('./cdn-local');
