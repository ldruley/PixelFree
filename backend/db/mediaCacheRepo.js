/**
 * db/mediaCacheRepo.js
 * --------------------
 * Repository for media_manifest table operations.
 *
 * Responsibilities:
 * - Insert/update media manifest entries
 * - Query cached media by status_id and kind
 * - List media for eviction (LRU, orphaned, expired)
 * - Calculate cache usage statistics
 * - Bulk operations for efficient cache management
 */

import db from './db.js';

/**
 * Insert or update a media manifest entry.
 *
 * @param {object} entry - Media manifest entry
 * @param {string} entry.status_id - Photo/status ID
 * @param {string} entry.kind - Media type ('preview' or 'original')
 * @param {string} entry.path - Relative path from cache root
 * @param {number} entry.content_length - File size in bytes
 * @param {string} [entry.etag] - ETag header value
 * @param {string} [entry.expires_at] - ISO timestamp for expiration
 * @returns {object} - Inserted/updated entry
 */
export function upsert(entry) {
    const now = new Date().toISOString();

    const stmt = db.prepare(`
    INSERT INTO media_manifest 
      (status_id, kind, path, content_length, fetched_at, last_accessed_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(status_id, kind) DO UPDATE SET
      path = excluded.path,
      content_length = excluded.content_length,
      fetched_at = excluded.fetched_at,
      last_accessed_at = excluded.last_accessed_at
  `);

    stmt.run(
        entry.status_id,
        entry.kind,
        entry.path,
        entry.content_length || 0,
        now,
        now
    );

    return get(entry.status_id, entry.kind);
}

/**
 * Get a media manifest entry by status_id and kind.
 *
 * @param {string} statusId - Photo/status ID
 * @param {string} kind - Media type ('preview' or 'original')
 * @returns {object|null} - Media manifest entry or null if not found
 */
export function get(statusId, kind) {
    const stmt = db.prepare(`
    SELECT * FROM media_manifest
    WHERE status_id = ? AND kind = ?
  `);

    return stmt.get(statusId, kind) || null;
}


/**
 * Check if media is cached for a given status_id and kind.
 *
 * @param {string} statusId - Photo/status ID
 * @param {string} kind - Media type ('preview' or 'original')
 * @returns {boolean} - True if cached
 */
export function isCached(statusId, kind) {
    return !!get(statusId, kind);
}
/**
 * Update last_accessed_at timestamp (touch for LRU).
 *
 * @param {string} statusId - Photo/status ID
 * @param {string} kind - Media type ('preview' or 'original')
 * @returns {boolean} - True if updated
 */
export function touch(statusId, kind) {
    const now = new Date().toISOString();

    const stmt = db.prepare(`
    UPDATE media_manifest 
    SET last_accessed_at = ?
    WHERE status_id = ? AND kind = ?
  `);

    const result = stmt.run(now, statusId, kind);
    return result.changes > 0;
}

/**
 * Delete a media manifest entry.
 *
 * @param {string} statusId - Photo/status ID
 * @param {string} kind - Media type ('preview' or 'original')
 * @returns {boolean} - True if deleted
 */
export function remove(statusId, kind) {
    const stmt = db.prepare(`
    DELETE FROM media_manifest
    WHERE status_id = ? AND kind = ?
  `);

    const result = stmt.run(statusId, kind);
    return result.changes > 0;
}

/**
 * Delete all media manifest entries for a given status_id.
 *
 * @param {string} statusId - Photo/status ID
 * @returns {number} - Number of entries deleted
 */
export function removeAllForStatus(statusId) {
    const stmt = db.prepare(`
    DELETE FROM media_manifest
    WHERE status_id = ?
  `);

    const result = stmt.run(statusId);
    return result.changes;
}

/**
 * Get total cache size in bytes.
 *
 * @returns {number} - Total size of all cached media
 */
export function getTotalSize() {
    const stmt = db.prepare(`
    SELECT COALESCE(SUM(content_length), 0) as total
    FROM media_manifest
  `);

    const result = stmt.get();
    return result?.total || 0;
}

/**
 * Get cache statistics.
 *
 * @returns {object} - Cache stats
 * @property {number} totalFiles - Total number of cached files
 * @property {number} totalBytes - Total size in bytes
 * @property {number} previewFiles - Number of preview files
 * @property {number} previewBytes - Size of preview files
 * @property {number} originalFiles - Number of original files
 * @property {number} originalBytes - Size of original files
 * @property {string|null} oldestFile - Oldest file by last_accessed_at
 * @property {string|null} newestFile - Newest file by fetched_at
 */
export function getStats() {
    const stmt = db.prepare(`
    SELECT 
      COUNT(*) as total_files,
      COALESCE(SUM(content_length), 0) as total_bytes,
      COUNT(CASE WHEN kind = 'preview' THEN 1 END) as preview_files,
      COALESCE(SUM(CASE WHEN kind = 'preview' THEN content_length ELSE 0 END), 0) as preview_bytes,
      COUNT(CASE WHEN kind = 'original' THEN 1 END) as original_files,
      COALESCE(SUM(CASE WHEN kind = 'original' THEN content_length ELSE 0 END), 0) as original_bytes,
      MIN(last_accessed_at) as oldest_accessed,
      MAX(fetched_at) as newest_fetched
    FROM media_manifest
  `);

    const result = stmt.get();

    return {
        totalFiles: result?.total_files || 0,
        totalBytes: result?.total_bytes || 0,
        previewFiles: result?.preview_files || 0,
        previewBytes: result?.preview_bytes || 0,
        originalFiles: result?.original_files || 0,
        originalBytes: result?.original_bytes || 0,
        oldestAccessed: result?.oldest_accessed || null,
        newestFetched: result?.newest_fetched || null
    };
}

/**
 * Find orphaned media (not referenced by any active album).
 * These are prime candidates for eviction.
 *
 * @param {number} [limit=100] - Maximum number to return
 * @returns {Array<object>} - Array of orphaned media entries
 */
export function findOrphaned(limit = 100) {
    const stmt = db.prepare(`
    SELECT mm.*
    FROM media_manifest mm
    LEFT JOIN album_items ai ON mm.status_id = ai.status_id
    WHERE ai.status_id IS NULL
    ORDER BY mm.last_accessed_at ASC
    LIMIT ?
  `);

    return stmt.all(limit);
}

/**
 * Find expired media based on expires_at timestamp.
 *
 * @param {number} [limit=100] - Maximum number to return
 * @returns {Array<object>} - Array of expired media entries
 */
export function findExpired(limit = 100) {
    const now = new Date().toISOString();

    const stmt = db.prepare(`
    SELECT * FROM media_manifest
    WHERE expires_at IS NOT NULL 
      AND expires_at < ?
    ORDER BY expires_at ASC
    LIMIT ?
  `);

    return stmt.all(now, limit);
}

/**
 * Find media for LRU eviction (least recently accessed).
 * Excludes orphaned and expired media (handle those separately).
 *
 * @param {number} [limit=100] - Maximum number to return
 * @returns {Array<object>} - Array of media entries sorted by LRU
 */
export function findLRU(limit = 100) {
    const now = new Date().toISOString();

    const stmt = db.prepare(`
    SELECT mm.*
    FROM media_manifest mm
    INNER JOIN album_items ai ON mm.status_id = ai.status_id
    WHERE mm.expires_at IS NULL OR mm.expires_at >= ?
    GROUP BY mm.status_id, mm.kind
    ORDER BY mm.last_accessed_at ASC
    LIMIT ?
  `);

    return stmt.all(now, limit);
}

/**
 * Get all media for a specific status_id.
 *
 * @param {string} statusId - Photo/status ID
 * @returns {Array<object>} - Array of media entries (preview and/or original)
 */
export function getAllForStatus(statusId) {
    const stmt = db.prepare(`
    SELECT * FROM media_manifest
    WHERE status_id = ?
    ORDER BY kind
  `);

    return stmt.all(statusId);
}

/**
 * List all media with optional filters.
 *
 * @param {object} [options] - Query options
 * @param {string} [options.kind] - Filter by kind ('preview' or 'original')
 * @param {number} [options.limit=100] - Maximum results
 * @param {number} [options.offset=0] - Offset for pagination
 * @param {string} [options.orderBy='last_accessed_at'] - Sort column
 * @param {string} [options.order='DESC'] - Sort direction
 * @returns {Array<object>} - Array of media entries
 */
export function list(options = {}) {
    const {
        kind,
        limit = 100,
        offset = 0,
        orderBy = 'last_accessed_at',
        order = 'DESC'
    } = options;

    const validOrderBy = ['last_accessed_at', 'fetched_at', 'content_length'];
    const validOrder = ['ASC', 'DESC'];

    const safeOrderBy = validOrderBy.includes(orderBy) ? orderBy : 'last_accessed_at';
    const safeOrder = validOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

    let sql = `SELECT * FROM media_manifest`;
    const params = [];

    if (kind) {
        sql += ` WHERE kind = ?`;
        params.push(kind);
    }

    sql += ` ORDER BY ${safeOrderBy} ${safeOrder}`;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = db.prepare(sql);
    return stmt.all(...params);
}

/**
 * Clear all media manifest entries.
 * WARNING: This does not delete the actual files from disk.
 *
 * @returns {number} - Number of entries deleted
 */
export function clearAll() {
    const stmt = db.prepare(`DELETE FROM media_manifest`);
    const result = stmt.run();
    return result.changes;
}