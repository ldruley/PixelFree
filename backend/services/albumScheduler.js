/**
 * services/albumScheduler.js
 * -----------------------
 * Backend service for managing album refresh scheduling and triggering.
 *
 * This service picks albums to refresh based on their schedule settings.
 *
 * Key Responsibilities:
 * - Interval based refreshing of albums with jitter
 * - Exponential backoff on rate limiting
 * - Respects album enabled/disabled state
 * - Uses global settings for default refresh intervals
 */

import * as albumRepo from '../db/albumRepo.js';
import * as photoFetcher from './photoFetcher.js';
import * as photoRepo from '../db/photoRepo.js';
import { getSettings } from '../modules/settings.js';
import {shapeAlbumRows} from "./albumService.js";
import * as albumService from "./albumService.js";

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
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000; // 6 hours max
const JITTER_PERCENTAGE = 10;

/**
 * Get the default refresh interval from settings
 * @returns {number} - Default refresh interval in milliseconds
 */
function getDefaultRefreshInterval() {
    const settings = getSettings();
    return settings.sync?.intervalMs || (24 * 60 * 60 * 1000); // 24 hours fallback
}

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
    const refresh = album.refresh || {};

    if (refresh.backoff_until) {
        const backoffUntil = new Date(refresh.backoff_until).getTime();
        if (now < backoffUntil) {
            return false;
        }
    }

    const lastChecked = refresh.last_checked_at
        ? new Date(refresh.last_checked_at).getTime()
        : 0;
    const refreshInterval = refresh.refresh_interval_ms || getDefaultRefreshInterval();
    const jitteredInterval = addJitter(refreshInterval);

    return now >= (lastChecked + jitteredInterval);
}

/**
 * Runs the album update scheduler tick.
 * @returns {Promise<void>}
 */
async function schedulerTick(){
    if(!isRunning) return;

    const now = new Date().toISOString();
    stats.last_run_at = now;
    stats.total_runs++;

    console.log(`[Scheduler] Starting run at ${now}`);

    try {
        //Get all enabled albums
        const {items: rawAlbums} = albumRepo.list({limit: 1000});
        const albums = shapeAlbumRows(rawAlbums);
        const dueAlbums = albums.filter(isDueForRefresh);

        if (dueAlbums.length === 0) {
            console.log('[Scheduler] No albums due for refresh');
            return;
        }

        console.log('[Scheduler] Found', dueAlbums.length, 'due albums');
        for (const album of dueAlbums) {
            if (!isRunning) break;
            console.log(`[Scheduler] Refreshing album ${album.id} "${album.name}"`);
            const result = await albumService.refreshAlbumWithBackoff(
                album.id,
                calculateBackoff
            );

            if (result.success) {
                console.log(`[Scheduler] ✓ Album ${album.id} refreshed:`, {
                    fetched: result.fetched,
                    upserted: result.upserted,
                    linked: result.linked
                });
                stats.albums_refreshed++;
            } else {
                console.error(`[Scheduler] ✗ Album ${album.id} refresh failed:`, result.error);
                stats.errors++;

                if (result.isRateLimited) {
                    console.log(`[Scheduler] Rate limited, backed off until ${result.backoff_until}`);
                    stats.rate_limited++;
                }
            }

            // Delay between refreshes
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (error) {
        console.error('[Scheduler] Error in scheduler run: ', error);
        stats.errors++;
    }
}

/**
 * Starts the album update scheduler.
 */
export async function startScheduler() {
    if(isRunning) {
        console.log('[Scheduler] Already running');
        return;
    }

    console.log('[Scheduler] Starting scheduler with interval:', TICK_INTERVAL_MS);

    isRunning = true;
    stats.started_at = new Date().toISOString();
    stats.total_runs = 0;
    stats.albums_refreshed = 0;
    stats.albums_skipped = 0;
    stats.errors = 0;
    stats.rate_limited = 0;

    await schedulerTick();

    schedulerTimer = setInterval(schedulerTick, TICK_INTERVAL_MS);
    console.log('[Scheduler] Scheduler started');
}

/**
 * Stops the album update scheduler.
 * @returns {Promise<void>}
 */
export async function stopScheduler() {
    if(!isRunning) {
        console.log('[Scheduler] Not running');
        return;
    }

    console.log('[Scheduler] Stopping scheduler');
    isRunning = false;
    if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
    }

    // Allow current operations to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('[Scheduler] Scheduler stopped');
}


/**
 * Get current scheduler status and statistics
 */
export function getStatus() {
    return {
        running: isRunning,
        tick_interval_ms: TICK_INTERVAL_MS,
        stats: { ...stats }
    };
}

/**
 * Force refresh of a specific album (bypasses scheduling)
 */
export async function forceRefreshAlbum(albumId) {
    const album = albumRepo.get(albumId);
    if (!album) {
        throw new Error('Album not found');
    }

    console.log(`[Scheduler] Force refresh requested for album ${albumId}`);
    await refreshAlbum(album);
}

// Convenience aliases for API routes
export const start = startScheduler;
export const stop = stopScheduler;