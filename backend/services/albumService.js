/**
 * services/albumService.js
 * -----------------------
 * High-level service for album operations and refresh logic.
 *
 * This service consolidates album refresh logic used by both:
 * - Manual refresh endpoint (API routes)
 * - Automatic refresh scheduler
 *
 * Key responsibilities:
 * - Fetch photos based on album query definition
 * - Upsert photos to database
 * - Link photos to albums
 * - Track refresh state (watermarks, timestamps)
 * - Handle errors and backoff
 */

import * as albumRepo from '../db/albumRepo.js';
import * as photoRepo from '../db/photoRepo.js';
import * as photoFetcher from './photoFetcher.js';
import { resolveManyAccts } from '../modules/accounts.js';

/**
 * Transform a raw database album row into a consistent shaped object.
 * Used by both API routes and internal services like the scheduler.
 *
 * @param {object} row - Raw album row from database
 * @returns {object} - Shaped album object with parsed JSON fields
 */
export function shapeAlbumRow(row) {
    if (!row) return null;

    const refresh = row.refresh_json ? JSON.parse(row.refresh_json) : {};

    return {
        id: row.id,
        name: row.name,
        created_at: row.created_at,
        updated_at: row.updated_at,
        enabled: !!row.enabled,
        query: {
            type: row.query_type,
            tags: row.query_tags ? JSON.parse(row.query_tags) : [],
            users: row.query_users ? JSON.parse(row.query_users) : [],
            tagmode: row.query_tagmode || 'any',
            limit: row.query_limit || 20
        },
        refresh
    };
}

/**
 * Transform multiple album rows
 * @param {object[]} rows - Array of raw album rows
 * @returns {object[]} - Array of shaped albums
 */
export function shapeAlbumRows(rows) {
    return (rows || []).map(shapeAlbumRow).filter(Boolean);
}

export function normalizeTags(tags) {
    if (!Array.isArray(tags)) return undefined;
    return tags
        .map(t => String(t || '').trim())
        .filter(Boolean)
        .map(t => t.replace(/^#/, '').toLowerCase());
}

/**
 * Parse users input into normalized shape.
 * @param users - Array of accts or { accts:[], ids:[] }
 * @returns {undefined|{}|{accts: *}} - Normalized users object or undefined
 */
export function parseUsers(users) {
    if (!users) return undefined;
    // Accept either { accts:[], ids:[] } or a flat array of accts
    if (Array.isArray(users)) return { accts: users.map(String) };
    const out = {};
    if (Array.isArray(users.accts)) out.accts = users.accts.map(String);
    if (Array.isArray(users.ids)) out.ids = users.ids.map(String);
    return (out.accts?.length || out.ids?.length) ? out : undefined;
}

/**
 * Parse JSON array from string, return empty array on failure.
 * @param row - JSON string
 * @returns {string} - Parsed array or empty array
 */
export function inferType(row) {
    if (row?.query_type) return String(row.query_type);
    const tags = parseJsonArray(row?.query_tags);
    const users = parseJsonArray(row?.query_users);
    if (tags.length && users.length) return 'compound';
    if (tags.length) return 'tag';
    if (users.length) return 'user';
    return 'tag';
}

/**
 * Validate album query object shape and values.
 * @param q - Album query object
 * @returns {null|string} - Null if valid, error message string if invalid
 */
export function validateQuery(q = {}) {
    const type = q.type;
    if (!['tag', 'user', 'compound'].includes(type || '')) {
        return 'query.type must be "tag" | "user" | "compound"';
    }
    const tagmode = q.tagmode || 'any';
    if (!['any', 'all'].includes(tagmode)) {
        return 'query.tagmode must be "any" | "all"';
    }
    const limit = q.limit == null ? 20 : Number(q.limit);
    if (!Number.isFinite(limit) || limit < 1 || limit > 40) {
        return 'query.limit must be an integer between 1 and 40';
    }
    if (type === 'tag') {
        const tags = normalizeTags(q.tags);
        if (!tags?.length) return 'query.tags must be a non-empty array for type "tag"';
    }
    if (type === 'user') {
        const users = parseUsers(q.users ?? q); // allow { accts:[] } or { users:{...} }
        if (!users) return 'query.users must include accts[] and/or ids[] for type "user"';
    }
    if (type === 'compound') {
        const tags = normalizeTags(q.tags);
        const users = parseUsers(q.users);
        if (!tags?.length) return 'compound query requires non-empty tags[]';
        if (!users) return 'compound query requires users.accts[] and/or users.ids[]';
    }
    return null;
}

/**
 * Calculate headroom multiplier based on query type.
 * More filtering = more headroom needed.
 *
 * @param {number} limit - Desired number of photos
 * @param {string} type - Query type ('tag', 'user', 'compound')
 * @param {string} tagmode - Tag mode ('any', 'all')
 * @returns {number} - Calculated headroom limit (capped at 200)
 */
function calculateHeadroom(limit, type, tagmode) {
    let multiplier = 2;

    if (type === 'compound') {
        multiplier = 5; // Heavy filtering (users AND tags)
    } else if (type === 'tag' && tagmode === 'all') {
        multiplier = 4; // Moderate filtering (ALL tags required)
    } else {
        multiplier = 2; // Light filtering (ANY tag or user posts)
    }

    return Math.min(limit * multiplier, 200);
}

/**
 * Fetch photos based on album query type.
 *
 * @param {object} query - Shaped album query (album.query)
 * @param {object} opts - Fetch options (limit, since_id, etc.)
 * @returns {Promise<Array>} - Array of photo objects
 */
async function fetchPhotosForQuery(query, opts = {}) {
    const { type, tags = [], users = [], tagmode = 'any' } = query;
    const limit = opts.limit || 20;
    const since_id = opts.since_id || null;

    const fetchParams = {
        limit,
        tagmode,
        since_id
    };

    let candidates = [];

    if (type === 'tag') {
        candidates = await photoFetcher.getLatestPhotosForTags(tags, fetchParams);
    } else if (type === 'user') {
        // Resolve usernames to account IDs at query time
        const accts = users.accts || [];
        const ids = users.ids || [];
        
        // Resolve accts to IDs
        const resolvedIds = accts.length > 0 
            ? await resolveManyAccts(accts) 
            : [];
        
        // Combine with any pre-resolved IDs
        const allIds = [...resolvedIds, ...ids];
        
        if (allIds.length === 0) {
            throw new Error('No valid user accounts found');
        }
        
        candidates = await photoFetcher.getLatestPhotosForUsers(allIds, fetchParams);
    } else if (type === 'compound') {
        // Resolve usernames for compound queries (user + tag)
        const accts = users.accts || [];
        const ids = users.ids || [];
        
        const resolvedIds = accts.length > 0 
            ? await resolveManyAccts(accts) 
            : [];
        
        const allIds = [...resolvedIds, ...ids];
        
        if (allIds.length === 0) {
            throw new Error('No valid user accounts found');
        }
        
        // This fetches posts from users, then filters by tags locally
        candidates = await photoFetcher.getLatestPhotosCompound(
            { tags, accountIds: allIds },
            fetchParams
        );
    } else {
        throw new Error(`Unsupported query type: ${type}`);
    }

    return Array.isArray(candidates) ? candidates : [];
}

/**
 * Find the newest photo from a collection by created_at.
 * @param {Array} photos - Array of photo objects
 * @returns {object|null} - Newest photo or null if none
 */
function findNewestPhoto(photos) {
    if (!photos?.length) return null;

    return photos.reduce((newest, photo) => {
        if (!newest) return photo;
        const newestDate = new Date(newest.created_at);
        const photoDate = new Date(photo.created_at);
        return photoDate > newestDate ? photo : newest;
    }, null);
}

/**
 * Core refresh logic: fetch, upsert, link photos to album.
 * Used by both manual refresh endpoint and automatic scheduler.
 *
 * @param {string} albumId - Album ID to refresh
 * @param {object} opts - Refresh options
 * @param {boolean} opts.updateWatermark - Whether to update since_id watermark
 * @param {boolean} opts.trackStats - Whether to return detailed stats
 * @returns {Promise<object>} - Refresh result with stats
 */
export async function refreshAlbum(albumId, opts = {}) {
    const {
        updateWatermark = true,
        trackStats = false
    } = opts;

    // Get and shape album
    const rawAlbum = albumRepo.get(albumId);
    if (!rawAlbum) {
        throw new Error('Album not found');
    }

    const album = shapeAlbumRow(rawAlbum);
    const refresh = album.refresh || {};

    // Calculate fetch parameters
    const limit = album.query.limit || 20;
    const headroom = calculateHeadroom(
        limit,
        album.query.type,
        album.query.tagmode
    );

    const fetchOpts = {
        limit: headroom,
        since_id: updateWatermark ? (refresh.since_id || null) : null
    };

    // Fetch photos
    const candidates = await fetchPhotosForQuery(album.query, fetchOpts);

    // Upsert photos to database
    const upsertedIds = photoRepo.upsertMany(candidates);
    const cleanIds = Array.from(new Set((upsertedIds || []).filter(Boolean)));

    // Link to album
    const linkedCount = albumRepo.addPhotos(albumId, cleanIds, trackStats) || 0;

    // Update refresh metadata
    const updates = {
        refresh: {
            ...refresh,
            last_checked_at: new Date().toISOString()
        }
    };

    // Update watermark if enabled
    if (updateWatermark && candidates.length > 0) {
        const newestPhoto = findNewestPhoto(candidates);
        if (newestPhoto?.id) {
            updates.refresh.since_id = newestPhoto.id;
        }
    }

    // Clear any previous errors/backoff on successful refresh
    if (updateWatermark) {
        updates.refresh.backoff_until = null;
        updates.refresh.last_error = null;
        updates.refresh.retry_count = 0;
    }

    albumRepo.update(albumId, updates);

    // Return stats
    return {
        albumId,
        albumName: album.name,
        type: album.query.type,
        tagmode: album.query.tagmode,
        requested: headroom,
        fetched: candidates.length,
        upserted: cleanIds.length,
        linked: trackStats ? linkedCount : undefined,
        since_id: updates.refresh.since_id || refresh.since_id || null
    };
}

/**
 * Refresh album with error handling and backoff logic.
 * Used by the scheduler for automatic refreshes.
 *
 * @param {string} albumId - Album ID to refresh
 * @param {Function} calculateBackoff - Function to calculate backoff time
 * @returns {Promise<object>} - Refresh result or error info
 */
export async function refreshAlbumWithBackoff(albumId, calculateBackoff) {
    const rawAlbum = albumRepo.get(albumId);
    if (!rawAlbum) {
        throw new Error('Album not found');
    }

    const album = shapeAlbumRow(rawAlbum);
    const refresh = album.refresh || {};

    try {
        const result = await refreshAlbum(albumId, {
            updateWatermark: true,
            trackStats: true
        });

        return { success: true, ...result };

    } catch (error) {
        console.error(`[AlbumService] Refresh failed for album ${albumId}:`, error);

        // Determine if this is a rate limit error
        const isRateLimited =
            error.code === 'rate_limited' ||
            error.message?.includes('429') ||
            error.status === 429;

        const updates = {
            refresh: {
                ...refresh,
                last_checked_at: new Date().toISOString(),
                last_error: error.message || String(error)
            }
        };

        // Apply backoff for rate limiting
        if (isRateLimited && calculateBackoff) {
            const retryCount = (refresh.retry_count || 0) + 1;
            const backoffMs = calculateBackoff(retryCount);
            updates.refresh.backoff_until = new Date(Date.now() + backoffMs).toISOString();
            updates.refresh.retry_count = retryCount;
        }

        albumRepo.update(albumId, updates);

        return {
            success: false,
            albumId,
            albumName: album.name,
            error: error.message || String(error),
            isRateLimited,
            backoff_until: updates.refresh.backoff_until || null
        };
    }
}

/**
 * Get album refresh status and statistics.
 *
 * @param {string} albumId - Album ID
 * @returns {object} - Refresh status info
 */
export function getAlbumRefreshStatus(albumId) {
    const rawAlbum = albumRepo.get(albumId);
    if (!rawAlbum) {
        throw new Error('Album not found');
    }

    const album = shapeAlbumRow(rawAlbum);
    const refresh = album.refresh || {};
    const { total } = albumRepo.listItems(albumId, { limit: 1, offset: 0 });

    const now = Date.now();
    const lastChecked = refresh.last_checked_at
        ? new Date(refresh.last_checked_at).getTime()
        : null;
    const backoffUntil = refresh.backoff_until
        ? new Date(refresh.backoff_until).getTime()
        : null;

    return {
        albumId,
        albumName: album.name,
        enabled: album.enabled,
        totalPhotos: total,
        lastChecked: refresh.last_checked_at || null,
        timeSinceLastCheck: lastChecked ? now - lastChecked : null,
        sinceId: refresh.since_id || null,
        isBackedOff: backoffUntil ? now < backoffUntil : false,
        backoffUntil: refresh.backoff_until || null,
        lastError: refresh.last_error || null,
        retryCount: refresh.retry_count || 0
    };
}

/**
 * Deduplicate photos by status_id (keep first occurrence)
 * @param {Array} photos - Array of photo objects with status_id
 * @returns {Array} - Deduplicated array of photos
 */
export function dedupeByStatusId(photos) {
    const seen = new Set();
    return photos.filter(p => {
        if (seen.has(p.status_id)) return false;
        seen.add(p.status_id);
        return true;
    });
}

/**
 * Round-robin merge: take one photo from each album in rotation
 * @param {Array} photos - Array of photo objects with album_id
 * @param {Array} albumIds - Ordered array of album IDs
 * @param {number} limit - Maximum number of photos to return
 * @returns {Array} - Merged array of photos
 */
export function roundRobinMerge(photos, albumIds, limit) {
    // Group photos by album
    const byAlbum = {};
    albumIds.forEach(id => byAlbum[id] = []);

    photos.forEach(p => {
        if (byAlbum[p.album_id]) {
            byAlbum[p.album_id].push(p);
        }
    });

    // Round-robin selection
    const result = [];
    const seen = new Set();
    let round = 0;

    while (result.length < limit) {
        let addedThisRound = false;

        for (const albumId of albumIds) {
            if (result.length >= limit) break;

            const albumPhotos = byAlbum[albumId];
            if (round < albumPhotos.length) {
                const photo = albumPhotos[round];
                // Skip if already added (dedupe across albums)
                if (!seen.has(photo.status_id)) {
                    result.push(photo);
                    seen.add(photo.status_id);
                    addedThisRound = true;
                }
            }
        }

        // If no photos added this round, we're done
        if (!addedThisRound) break;
        round++;
    }

    return result;
}

/**
 * Fisher-Yates shuffle
 * @param {Array} array - Array to shuffle
 * @returns {Array} - Shuffled array
 */
export function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
