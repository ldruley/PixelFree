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