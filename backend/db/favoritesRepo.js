// backend/db/favoritesRepo.js
// Repository for managing favorite photos

import db from './db.js';

/**
 * Add a photo to favorites.
 * @param {string} statusId - The status_id of the photo to favorite
 * @param {string} [note] - Optional note for the favorite
 * @returns {{ statusId: string, favorited_at: string, note?: string}}
 */
export function addFavorite(statusId, note = null) {
    const favorited_at = new Date().toISOString();
    db.prepare(`
        INSERT INTO favorites (status_id, favorited_at, note)
        VALUES (?, ?, ?)
        ON CONFLICT(status_id) DO UPDATE SET
          favorited_at = excluded.favorited_at,
          note = COALESCE(excluded.note, note)
      `).run(statusId, favorited_at, note);

    return { statusId, favorited_at, note };
}

/**
 * Remove a photo from favorites.
 * @param {string} statusId - The status_id to remove
 * @returns {boolean}  - true if removed, false if not found
 */
export function removeFavorite(statusId) {
    const info = db.prepare(`
        DELETE FROM favorites
        WHERE status_id = ?
    `).run(statusId);
    return info.changes > 0;
}


/**
 * Check if a photo is favorited
 * @param {string} statusId
 * @returns {boolean}
 */
export function isFavorited(statusId) {
    const row = db.prepare('SELECT 1 FROM favorites WHERE status_id = ?').get(statusId);
    return !!row;
}


/**
 * Get favorite metadata for a photo
 * @param {string} statusId
 * @returns {{ status_id: string, favorited_at: string, note: string|null } | null}
 */
export function getFavorite(statusId) {
    return db.prepare('SELECT * FROM favorites WHERE status_id = ?').get(statusId);
}
/**
 * Get favorite metadata for multiple photos
 * @param {string[]} statusIds - Array of status IDs to check
 * @returns {Array<{ status_id: string, favorited_at: string, note: string|null }>}
 */
export function getFavorites(statusIds) {
    if (!statusIds || statusIds.length === 0) {
        return [];
    }

    const placeholders = statusIds.map(() => '?').join(',');
    const query = `SELECT * FROM favorites WHERE status_id IN (${placeholders})`;
    return db.prepare(query).all(...statusIds);
}

/**
 * Check favorite status for multiple photos
 * @param {string[]} statusIds - Array of status IDs to check
 * @returns {Object<string, boolean>} - Map of statusId to boolean favorite status
 */
export function checkFavoritesStatus(statusIds) {
    if (!statusIds || statusIds.length === 0) {
        return {};
    }

    const placeholders = statusIds.map(() => '?').join(',');
    const query = `SELECT status_id FROM favorites WHERE status_id IN (${placeholders})`;
    const favorited = db.prepare(query).all(...statusIds);

    const statusMap = {};
    statusIds.forEach(id => statusMap[id] = false);
    favorited.forEach(row => statusMap[row.status_id] = true);

    return statusMap;
}

/**
 * Add multiple photos to favorites
 * @param {Array<{statusId: string, note?: string}>} items - Array of items to favorite
 * @returns {Array<{ statusId: string, favorited_at: string, note?: string, success: boolean, error?: string }>}
 */
export function addFavorites(items) {
    const results = [];
    const favorited_at = new Date().toISOString();

    const stmt = db.prepare(`
        INSERT INTO favorites (status_id, favorited_at, note)
        VALUES (?, ?, ?)
        ON CONFLICT(status_id) DO UPDATE SET
          favorited_at = excluded.favorited_at,
          note = COALESCE(excluded.note, note)
    `);

    for (const item of items) {
        try {
            stmt.run(item.statusId, favorited_at, item.note || null);
            results.push({
                statusId: item.statusId,
                favorited_at,
                note: item.note || null,
                success: true
            });
        } catch (error) {
            results.push({
                statusId: item.statusId,
                success: false,
                error: error.message
            });
        }
    }

    return results;
}

/**
 * Remove multiple photos from favorites
 * @param {string[]} statusIds - Array of status IDs to remove
 * @returns {Array<{ statusId: string, success: boolean }>}
 */
export function removeFavorites(statusIds) {
    const results = [];
    const stmt = db.prepare('DELETE FROM favorites WHERE status_id = ?');

    for (const statusId of statusIds) {
        const info = stmt.run(statusId);
        results.push({
            statusId,
            success: info.changes > 0
        });
    }

    return results;
}
/**
 * List all favorited photos with pagination
 * @param {{ offset?: number, limit?: number }} options
 * @returns {{ items: Array, total: number, offset: number, limit: number }}
 */
export function listFavorites({ offset = 0, limit = 20 } = {}) {
    //Join with photos table to get full photo details
    const rows = db.prepare(`
        SELECT
            p.*,
            f.favorited_at,
            f.note as favorite_note
        FROM favorites f
        JOIN photos p ON p.status_id = f.status_id
        ORDER BY f.favorited_at DESC
        LIMIT ? OFFSET ?
    `).all(limit, offset);

    const total = db.prepare('SELECT COUNT(*) as c FROM favorites').get().c;

    return { items: rows, total, offset, limit };
}


/**
 * Get count of favorites
 * @returns {number}
 */
export function getFavoritesCount() {
    const row = db.prepare('SELECT COUNT(*) as c FROM favorites').get();
    return row.c;
}