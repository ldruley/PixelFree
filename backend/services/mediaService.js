/**
 * services/mediaService.js
 * ------------------------
 * High-level service for media cache management.
 *
 * Responsibilities:
 * - Download media from remote URLs and cache locally
 * - Serve cached media or proxy to remote
 * - Enforce cache quota with LRU eviction
 * - Handle TTL expiration
 * - Orphan cleanup
 * - Cache statistics and health
 *
 * This service coordinates between:
 * - mediaStorage (filesystem operations)
 * - mediaCacheRepo (database operations)
 * - Settings (quota configuration)
 *
 *  Potential future enhancements:
 *  - Support rate limiting on downloads
 */

import * as mediaStorage from '../utils/mediaStorage.js';
import * as mediaCacheRepo from '../db/mediaCacheRepo.js';
import * as photoRepo from '../db/photoRepo.js';
import { getSettings, updateSettings } from '../modules/settings.js';
import path from 'path';

// Default configuration
const DEFAULT_QUOTA_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const DEFAULT_TTL_DAYS = 60; // 60 days
const EVICTION_THRESHOLD = 0.9; // Start evicting at 90% quota
const EVICTION_TARGET = 0.75; // Evict down to 75% quota


/**
 * Get the current cache quota from settings.
 *
 * @returns {number} - Quota in bytes
 */
function getQuota() {
    const settings = getSettings();
    return settings.cache?.quotaBytes || DEFAULT_QUOTA_BYTES;
}


/**
 * Get the default TTL in days from settings.
 *
 * @returns {number} - TTL in days
 */
function getTTL() {
    const settings = getSettings();
    return settings.cache?.ttlDays || DEFAULT_TTL_DAYS;
}

/**
 * Download and cache a media file from a remote URL.
 *
 * @param {object} photo - Photo object from database
 * @param {string} kind - Media type ('preview' or 'original')
 * @param {object} [options] - Download options
 * @param {boolean} [options.skipIfExists=true] - Skip download if already cached
 * @param {boolean} [options.touchOnSkip=true] - Update last_accessed_at if skipped
 * @returns {Promise<object>} - Result with cached file info
 * @property {boolean} cached - True if file is now in cache
 * @property {boolean} downloaded - True if file was downloaded (vs already cached)
 * @property {string} path - Relative path to cached file
 * @property {number} size - File size in bytes
 */
export async function cacheMedia(photo, kind, options = {}) {
    const {skipIfExists = true, touchOnSkip = true} = options;

    // Validate inputs
    if (!photo?.status_id) {
        throw new Error('Photo must have status_id');
    }

    if (!['preview', 'original'].includes(kind)) {
        throw new Error('Kind must be "preview" or "original"');
    }

    const statusId = photo.status_id;

    // Check if already cached
    if (skipIfExists && mediaCacheRepo.isCached(statusId, kind)) {
        if (touchOnSkip) {
            mediaCacheRepo.touch(statusId, kind);
        }

        const existing = mediaCacheRepo.get(statusId, kind);
        return {
            cached: true,
            downloaded: false,
            path: existing.path,
            size: existing.content_length,
            statusId
        };
    }

    // Determine which URL to use
    const url = kind === 'preview' ? photo.preview_url : photo.url;

    if (!url) {
        throw new Error(`No ${kind} URL available for photo ${statusId}`);
    }
    // Infer extension from URL
    const extension = mediaStorage.inferExtension(url);

    // Get filesystem path
    const relativePath = mediaStorage.getRelativePath(statusId, kind, extension);
    const absolutePath = mediaStorage.getMediaPath(statusId, kind, extension);

    try {
        // Download the file
        const downloadResult = await mediaStorage.downloadMedia(url, absolutePath, {
            timeout: 60000 // 60 second timeout for large images (placeholder)
        });

        // Calculate expires_at
        const expiresAt = mediaStorage.calculateExpiresAt({
            maxAge: downloadResult.maxAge,
            defaultTtlDays: getTTL()
        });

        // Record in database
        mediaCacheRepo.upsert({
            status_id: statusId,
            kind,
            path: relativePath,
            content_length: downloadResult.contentLength,
            etag: downloadResult.etag,
            expires_at: expiresAt
        });

        // Check if we need to evict after this download
        await checkAndEvict();

        return {
            cached: true,
            downloaded: true,
            path: relativePath,
            size: downloadResult.contentLength,
            statusId,
            expiresAt
        };
    } catch (error) {
        // Clean up partial download if it exists
        try {
            await mediaStorage.deleteMedia(absolutePath);
        } catch {}

        throw new Error(`Failed to cache ${kind} for ${statusId}: ${error.message}`);
    }
}

/**
 * Get the absolute path to a cached media file, if it exists.
 *
 * @param {string} statusId - Photo/status ID
 * @param {string} kind - Media type ('preview' or 'original')
 * @returns {Promise<object|null>} - File info or null if not cached
 * @property {string} path - Absolute path to file
 * @property {number} size - File size in bytes
 * @property {boolean} exists - True if file exists on disk
 */
export async function getCachedPath(statusId, kind) {
    const entry = mediaCacheRepo.get(statusId, kind);

    if (!entry) {
        return null;
    }

    // Construct absolute path
    const absolutePath = path.join(mediaStorage.getCacheRoot(), entry.path);

    // Verify file actually exists and matches expected size
    const exists = await mediaStorage.verifyFile(absolutePath, entry.content_length);

    if (!exists) {
        // File is in database but missing from disk - clean up the database entry
        mediaCacheRepo.remove(statusId, kind);
        return null;
    }

    // Update last_accessed_at (LRU tracking)
    mediaCacheRepo.touch(statusId, kind);

    return {
        path: absolutePath,
        size: entry.content_length,
        exists: true,
        entry
    };
}

/**
 * Check if cache quota is exceeded and trigger eviction if needed.
 *
 * @param {object} [options] - Eviction options
 * @param {number} [options.targetBytes] - Override target size
 * @returns {Promise<object>} - Eviction result
 */
export async function checkAndEvict(options = {}) {
    const quota = getQuota();
    const currentSize = mediaCacheRepo.getTotalSize();

    // Calculate thresholds
    const threshold = quota * EVICTION_THRESHOLD;
    const target = options.targetBytes || (quota * EVICTION_TARGET);

    if (currentSize <= threshold) {
        return {
            evicted: false,
            currentSize,
            quota,
            reason: 'below_threshold'
        };
    }

    // Need to evict
    return await evict({ targetBytes: target });
}

/**
 * Evict media to free up space based on strategy:
 * 1. Expired files first
 * 2. Orphaned files (not in any album)
 * 3. LRU (least recently accessed)
 *
 * @param {object} [options] - Eviction options
 * @param {number} [options.targetBytes] - Target size after eviction
 * @param {number} [options.maxFiles=100] - Maximum files to evict in one pass
 * @returns {Promise<object>} - Eviction result
 */
export async function evict(options = {}) {
    const { maxFiles = 100 } = options;
    const quota = getQuota();
    const targetBytes = options.targetBytes || (quota * EVICTION_TARGET);

    let currentSize = mediaCacheRepo.getTotalSize();
    let filesDeleted = 0;
    let bytesFreed = 0;

    const deleted = {
        expired: 0,
        orphaned: 0,
        lru: 0
    };

    // Stop if we're already below target
    if (currentSize <= targetBytes) {
        return {
            evicted: false,
            reason: 'already_below_target',
            currentSize,
            targetBytes,
            filesDeleted: 0,
            bytesFreed: 0
        };
    }

    // Phase 1: Evict expired files
    const expired = mediaCacheRepo.findExpired(maxFiles);
    for (const entry of expired) {
        if (currentSize <= targetBytes || filesDeleted >= maxFiles) break;

        const success = await deleteMediaEntry(entry);
        if (success) {
            filesDeleted++;
            bytesFreed += entry.content_length || 0;
            currentSize -= entry.content_length || 0;
            deleted.expired++;
        }
    }

    // Phase 2: Evict orphaned files
    if (currentSize > targetBytes && filesDeleted < maxFiles) {
        const orphaned = mediaCacheRepo.findOrphaned(maxFiles - filesDeleted);
        for (const entry of orphaned) {
            if (currentSize <= targetBytes || filesDeleted >= maxFiles) break;

            const success = await deleteMediaEntry(entry);
            if (success) {
                filesDeleted++;
                bytesFreed += entry.content_length || 0;
                currentSize -= entry.content_length || 0;
                deleted.orphaned++;
            }
        }
    }

    // Phase 3: LRU eviction
    if (currentSize > targetBytes && filesDeleted < maxFiles) {
        const lru = mediaCacheRepo.findLRU(maxFiles - filesDeleted);
        for (const entry of lru) {
            if (currentSize <= targetBytes || filesDeleted >= maxFiles) break;

            const success = await deleteMediaEntry(entry);
            if (success) {
                filesDeleted++;
                bytesFreed += entry.content_length || 0;
                currentSize -= entry.content_length || 0;
                deleted.lru++;
            }
        }
    }

    return {
        evicted: true,
        filesDeleted,
        bytesFreed,
        currentSize,
        targetBytes,
        quota,
        breakdown: deleted
    };
}

/**
 * Delete a media entry from both database and filesystem.
 *
 * @param {object} entry - Media manifest entry
 * @returns {Promise<boolean>} - True if successfully deleted
 */
async function deleteMediaEntry(entry) {
    const absolutePath = path.join(mediaStorage.getCacheRoot(), entry.path);

    try {
        // Delete from filesystem
        await mediaStorage.deleteMedia(absolutePath);

        // Delete from database
        mediaCacheRepo.remove(entry.status_id, entry.kind);

        return true;
    } catch (error) {
        console.error(`[MediaService] Failed to delete ${entry.path}:`, error.message);

        // Even if file deletion failed, remove from database to keep them in sync
        mediaCacheRepo.remove(entry.status_id, entry.kind);

        return false;
    }
}

/**
 * Clear all media cache (database and files).
 *
 * @returns {Promise<object>} - Clear result
 */
export async function clearAll() {
    const stats = mediaCacheRepo.getStats();
    const entries = mediaCacheRepo.list({ limit: 10000 }); // Get all entries

    let filesDeleted = 0;
    let bytesFreed = 0;

    for (const entry of entries) {
        const success = await deleteMediaEntry(entry);
        if (success) {
            filesDeleted++;
            bytesFreed += entry.content_length || 0;
        }
    }

    return {
        filesDeleted,
        bytesFreed,
        previousStats: stats
    };
}

/**
 * Get cache statistics and health information.
 *
 * @returns {object} - Cache statistics
 */
export function getStats() {
    const stats = mediaCacheRepo.getStats();
    const quota = getQuota();
    const ttl = getTTL();

    return {
        ...stats,
        quota,
        quotaMB: Math.round(quota / 1024 / 1024),
        totalMB: Math.round(stats.totalBytes / 1024 / 1024),
        usagePercent: quota > 0 ? Math.round((stats.totalBytes / quota) * 100) : 0,
        ttlDays: ttl,
        cacheRoot: mediaStorage.getCacheRoot()
    };
}

/**
 * Update cache quota setting.
 *
 * @param {number} quotaBytes - New quota in bytes
 * @returns {object} - Updated settings
 */
export function setQuota(quotaBytes) {
    const settings = getSettings();
    const updated = {
        ...settings,
        cache: {
            ...settings.cache,
            quotaBytes: Math.max(quotaBytes, 100 * 1024 * 1024) // Minimum 100 MB
        }
    };

    updateSettings(updated);
    return updated;
}

/**
 * Update cache TTL setting.
 *
 * @param {number} ttlDays - New TTL in days
 * @returns {object} - Updated settings
 */
export function setTTL(ttlDays) {
    const settings = getSettings();
    const updated = {
        ...settings,
        cache: {
            ...settings.cache,
            ttlDays: Math.max(ttlDays, 1) // Minimum 1 day
        }
    };

    updateSettings(updated);
    return updated;
}


/**
 * Preload media for an array of photos.
 * Downloads in background without blocking.
 *
 * @param {Array<object>} photos - Array of photo objects
 * @param {string} [kind='preview'] - Media type to preload
 * @param {number} [maxConcurrent=3] - Maximum concurrent downloads
 * @returns {Promise<object>} - Preload result
 */
export async function preload(photos, kind = 'preview', maxConcurrent = 3) {
    if (!Array.isArray(photos) || photos.length === 0) {
        return { preloaded: 0, failed: 0, skipped: 0 };
    }

    let preloaded = 0;
    let failed = 0;
    let skipped = 0;

    // Process in batches to limit concurrency
    for (let i = 0; i < photos.length; i += maxConcurrent) {
        const batch = photos.slice(i, i + maxConcurrent);

        const results = await Promise.allSettled(
            batch.map(photo => cacheMedia(photo, kind, { skipIfExists: true }))
        );

        for (const result of results) {
            if (result.status === 'fulfilled') {
                if (result.value.downloaded) {
                    preloaded++;
                } else {
                    skipped++;
                }
            } else {
                failed++;
            }
        }
    }

    return { preloaded, failed, skipped };
}

/**
 * Get all cached media for a specific status_id.
 *
 * @param {string} statusId - Photo/status ID
 * @returns {Array<object>} - Array of media manifest entries
 */
export function getAllForStatus(statusId) {
    return mediaCacheRepo.getAllForStatus(statusId);
}

/**
 * Delete cached media for a specific status_id and kind.
 *
 * @param {string} statusId - Photo/status ID
 * @param {string} kind - Media type ('preview' or 'original')
 * @returns {Promise<boolean>} - True if successfully deleted
 */
export async function deleteCachedMedia(statusId, kind) {
    const entry = mediaCacheRepo.get(statusId, kind);

    if (!entry) {
        return false;
    }

    const absolutePath = path.join(mediaStorage.getCacheRoot(), entry.path);

    try {
        // Delete from filesystem
        await mediaStorage.deleteMedia(absolutePath);

        // Delete from database
        mediaCacheRepo.remove(statusId, kind);

        return true;
    } catch (error) {
        console.error(`[MediaService] Failed to delete ${statusId}/${kind}:`, error.message);

        // Even if file deletion failed, remove from database to keep them in sync
        mediaCacheRepo.remove(statusId, kind);

        throw error;
    }
}

/**
 * Initialize media cache system.
 * Should be called on application startup.
 *
 * @returns {Promise<void>}
 */
export async function initialize() {
    await mediaStorage.initializeCacheDirectory();
    console.log('[MediaService] Initialized cache directory:', mediaStorage.getCacheRoot());
}