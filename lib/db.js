'use strict';

/**
 * Pemilih backend database.
 *   DB_MODE=local (default) → lib/db-local.js    — file JSON di disk
 *   DB_MODE=external        → lib/db-external.js — DongtubeDB via REST
 */
module.exports = (process.env.DB_MODE || 'local') === 'external'
  ? require('./db-external')
  : require('./db-local');
