/**
 * services/albumScheduler.js
 * -----------------------
 * Backend service for managing album refresh scheduling and triggering.
 *
 * This service picks albums to refresh based on their schedule settings (refresh_interval_ms) if the
 * last_checked_at timestamp is older than the refresh_interval_ms,
 * while respecting per-album backoff_until if rate limited.
 *
 * Key Responsibilities:
 * - Interval based refreshing of albums with jitter
 * - Exponential backoff based on backoff_until
 * - Respects album enabled/disabled state
 *
 * TODO:
 *  - Connect to user settings to adjust refresh interval and enable/disable scheduled updates
 *  - Better error handling - handle rate limits, server errors, etc.
 *  - what should we do with max id here?
 */

import * as albumRepo from '../db/albumRepo.js';
import * as photoFetcher from './photoFetcher.js';
import * as photoRepo from '../db/photoRepo.js';

let schedulerTimer = null;
let isRunning = false;
let stats = {
    started_at: null,
    last_run_at: null,
    total_runs: 0,
    albums_refreshed: 0,
    albums_skipped: 0,
    errors: 0,
    rate_limited: 0,
}

// Config
const TICK_INTERVAL_MS = 60 * 1000; // Check every minute
const DEFAULT_REFRESH = 24 * 60 * 60 * 1000; // 24 hours
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000; // 6 hours - placeholder
const JITTER_PERCENTAGE = 10;

/**
 * Adds random jitter to a given interval in milliseconds.
 * @param ms
 * @returns {number}
 */
function addJitter(ms) {
    const jitter = ms * (JITTER_PERCENTAGE / 100);
    const randomOffset = (Math.random() - 0.5) * 2 * jitter;
    return Math.round(ms + randomOffset);
}

/**
 * Calculates exponential backoff
 * @param attemptCount
 * @param baseMs
 * @returns {number}
 */
function calculateBackoff(attemptCount, baseMs = 60 * 1000) {
    const backoff = Math.min(baseMs * Math.pow(2, attemptCount), MAX_BACKOFF_MS);
    return addJitter(backoff);
}

/**
 * Checks if an album is due for refresh based on its schedule and backoff.
 * @param album
 * @returns {boolean}
 */
function isDueForRefresh(album) {
    if (!album.enabled) return false;

    const now = new Date();
    const refresh = JSON.parse(album.refresh_json || '{}');
    // Check backoff first
    if (refresh.backoff_until) {
        const backoffUntil = new Date(refresh.backoff_until).getTime();
        if (now < backoffUntil) {
            return false;
        }
    }

    const lastChecked = refresh.last_checked_at ? new Date(refresh.last_checked_at).getTime() : 0;
    const refreshInterval = refresh.refresh_interval_ms || DEFAULT_REFRESH;
    const jitteredInterval = addJitter(refreshInterval);
    return now >= (lastChecked + jitteredInterval);
}

/**
 * Refreshes a single album by fetching latest photos and updating the database.
 * @param album
 * @returns {Promise<void>}
 */
async function refreshAlbum(album) {
    const albumId = album.id;
    const refresh = JSON.parse(album.refresh_json || '{}');

    try {
        console.log(`[Scheduler] Refreshing album ${albumId} "${album.name}"`);

        // Parse query components
        const type = album.query_type || 'tag';
        const tags = album.query_tags ? JSON.parse(album.query_tags) : [];
        const users = album.query_users ? JSON.parse(album.query_users) : [];
        const tagmode = album.query_tagmode || 'any';
        const limit = album.query_limit || 20;
        const headroom = Math.min(limit * 5, 200); // extra room for filtering

        const fetchParams = {
            limit: headroom,
            tagmode,
            since_id: refresh.since_id || null,
            max_id: refresh.max_id || null,
        };

        let candidates = [];

        if (type === 'tag') {
            candidates = await photoFetcher.getLatestPhotosForTags(tags, fetchParams);
        } else if (type === 'user') {
            candidates = await photoFetcher.getLatestPhotosForUsers(users, fetchParams);
        } else if (type === 'compound') {
            candidates = await photoFetcher.getLatestPhotosCompound({tags, accountIds: users}, fetchParams);
        }

        candidates = Array.isArray(candidates) ? candidates : [];

        //Upsert photos
        const upsertedIds = photoRepo.upsertMany(candidates);
        const cleanIds = Array.from(new Set(upsertedIds.filter(Boolean)));

        // Link photos to album
        const linkedCount = albumRepo.addPhotos(albumId, cleanIds) || 0;

        // Update refresh watermarks
        let newSinceId = refresh.since_id;
        let newMaxId = refresh.max_id;

        if (candidates.length > 0) {
            const newestPost = candidates.reduce((newest, post) =>
                !newest || new Date(post.created_at) > new Date(newest.created_at) ? post : newest, null
            );
            if (newestPost) {
                newSinceId = newestPost.id;
            }
        }

        const updatedRefresh = {
            ...refresh,
            last_checked_at: new Date().toISOString(),
            since_id: newSinceId,
            max_id: newMaxId,
            backoff_until: null,
            last_error: null,
            retry_count: 0
        }

        albumRepo.update(albumId, {refresh: updatedRefresh});

        console.log(`[Scheduler] Album ${albumId} "${album.name}" refreshed with ${cleanIds.length} new photos`);
        stats.albums_refreshed++;
    } catch (error) {
        console.error(`[Scheduler] Error refreshing album ${albumId} "${album.name}":`, error);
        stats.errors++;
    }
}

async function schedulerTick(){

}