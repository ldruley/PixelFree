// backend/db/kvRepo.js
// Key-Value store helper for global metadata, feature flags, and app settings.
//
/* Usage example:
  import * as kv from '../db/kvRepo.js';

  // Set a value
  kv.set('schema_version', '1');

  // Get a value
  console.log(kv.get('schema_version'));  // → "1"
  console.log(kv.get('missing', 'default'));  // → "default"

  // Remove a value
  kv.remove('schema_version');

  // Debugging: list all keys
  console.log(kv.list());
*/

import db from './db.js';

/**
 * Retrieve a value from the kv table.
 * @param {string} key
 * @param {*} defaultValue Returned if key not found
 * @returns {string|null}
 */
export function get(key, defaultValue = null) {
  const row = db.prepare(
    `SELECT v FROM kv WHERE k = ?`
  ).get(key);
  return row ? row.v : defaultValue;
}

/**
 * Insert or update a value.
 * @param {string} key
 * @param {string} value
 */
export function set(key, value) {
  db.prepare(`
    INSERT INTO kv (k, v)
    VALUES (?, ?)
    ON CONFLICT(k) DO UPDATE SET v = excluded.v
  `).run(key, value);
}

/**
 * Delete a key.
 * @param {string} key
 * @returns {boolean} true if deleted, false if not found
 */
export function remove(key) {
  const info = db.prepare(`DELETE FROM kv WHERE k = ?`).run(key);
  return info.changes > 0;
}

/**
 * Return all kv entries (useful for debugging).
 * @returns {Array<{k: string, v: string}>}
 */
export function list() {
  return db.prepare(`SELECT k, v FROM kv ORDER BY k`).all();
}