/**
 * api/cacheSettingsRoutes.js
 * ---------------------------
 * Settings and cache management endpoints.
 *
 * This module handles:
 * 1. Settings (display, sync, source config)
 * 2. Media cache management (stats, eviction, quota)
 * 3. Cache preloading and cleanup
 *
 **/

import express from 'express';
import * as cache from '../modules/cache.js';
import * as settings from '../modules/settings.js';
import * as mediaService from "../services/mediaService.js";
import {NotFoundError, ValidationError} from "../modules/errors.js";
import {asyncHandler} from "../utils/errorMapper.js";

export default function mountCacheSettingsRoutes(app) {
    const router = express.Router();


    // =============================================================================
    // SETTINGS ROUTES
    // =============================================================================

    // GET /api/settings
    router.get('/settings', (_req, res) => {
        console.log('[API] GET /api/settings');
        res.json(settings.getSettings());
    });

    // POST /api/settings
    router.post('/settings', (req, res) => {
        console.log('[API] POST /api/settings', req.body);
        settings.updateSettings(req.body || {});
        res.json({status: 'Settings updated'});
    });

    // Mount under /api
    app.use('/api', router);

    // =============================================================================
    // MEDIA CACHE STATISTICS
    // =============================================================================

    /**
     * GET /api/cache/stats
     * Get comprehensive cache statistics.
     *
     * Returns:
     * - totalFiles, totalBytes - Overall cache size
     * - previewFiles/Bytes, originalFiles/Bytes - Breakdown by type
     * - quota, quotaMB - Configured cache size limit
     * - usagePercent - Current usage as percentage of quota
     * - ttlDays - Default expiration period
     * - cacheRoot - Filesystem path to cache directory
     */
    router.get('/cache/stats', asyncHandler(async (req, res) => {
        const stats = mediaService.getStats();
        res.json(stats);
    }));

    // =============================================================================
    // CACHE EVICTION
    // =============================================================================

    /**
     * POST /api/cache/evict
     * Manually trigger cache eviction.
     *
     * Uses three-phase eviction strategy:
     * 1. Expired files (past TTL)
     * 2. Orphaned files (not in any album)
     * 3. LRU files (least recently accessed)
     *
     * Body (optional):
     * {
     *   "targetBytes": 1073741824,  // Target size after eviction (defaults to 75% of quota)
     *   "maxFiles": 100              // Max files to evict in one pass (defaults to 100)
     * }
     *
     * Returns:
     * {
     *   "evicted": true,
     *   "filesDeleted": 23,
     *   "bytesFreed": 45678901,
     *   "currentSize": 1234567890,
     *   "targetBytes": 1073741824,
     *   "quota": 2147483648,
     *   "breakdown": {
     *     "expired": 5,
     *     "orphaned": 10,
     *     "lru": 8
     *   }
     * }
     */
    router.post('/cache/evict', asyncHandler(async (req, res) => {
        const { targetBytes, maxFiles } = req.body || {};

        const options = {};
        if (targetBytes !== undefined) {
            options.targetBytes = Number(targetBytes);
        }
        if (maxFiles !== undefined) {
            options.maxFiles = Number(maxFiles);
        }

        const result = await mediaService.evict(options);

        res.json({
            success: true,
            ...result
        });
    }));

    // =============================================================================
    // CACHE CLEARING
    // =============================================================================

    /**
     * DELETE /api/cache
     * Clear entire media cache.
     *
     * WARNING: This removes all cached files and database entries.
     * Use with caution - this is a destructive operation.
     *
     * Returns:
     * {
     *   "success": true,
     *   "message": "Cache cleared",
     *   "filesDeleted": 156,
     *   "bytesFreed": 2147483648,
     *   "previousStats": { ... }
     * }
     */
    router.delete('/cache', asyncHandler(async (req, res) => {
        const result = await mediaService.clearAll();

        res.json({
            success: true,
            message: 'Cache cleared',
            ...result
        });
    }));

    /**
     * DELETE /api/cache/media/:statusId
     * Clear cached media for a specific photo.
     *
     * Removes both preview and original if cached.
     * Useful for forcing re-download of specific photos.
     *
     * Returns:
     * {
     *   "success": true,
     *   "statusId": "123456",
     *   "deletedCount": 2,
     *   "bytesFreed": 4567890
     * }
     */
    router.delete('/cache/media/:statusId', asyncHandler(async (req, res) => {
        const { statusId } = req.params;

        if (!statusId) {
            throw new ValidationError('status_id is required');
        }

        // Get all cached media for this status
        const entries = await mediaService.getAllForStatus(statusId);

        if (!entries || entries.length === 0) {
            throw new NotFoundError('No cached media found for photo', { statusId });
        }

        // Delete each cached file
        let deletedCount = 0;
        let bytesFreed = 0;

        for (const entry of entries) {
            try {
                await mediaService.deleteCachedMedia(statusId, entry.kind);
                deletedCount++;
                bytesFreed += entry.content_length || 0;
            } catch (err) {
                console.error(`[CacheSettings] Failed to delete ${statusId}/${entry.kind}:`, err.message);
            }
        }

        res.json({
            success: true,
            statusId,
            deletedCount,
            bytesFreed
        });
    }));

    // =============================================================================
    // CACHE CONFIGURATION
    // =============================================================================

    /**
     * PUT /api/cache/settings
     * Update cache configuration.
     *
     * Body:
     * {
     *   "quotaBytes": 2147483648,  // 2 GB (minimum 100 MB)
     *   "ttlDays": 60               // Days to keep cached files (minimum 1)
     * }
     *
     * Returns updated cache settings.
     */
    router.put('/cache/settings', asyncHandler(async (req, res) => {
        const { quotaBytes, ttlDays } = req.body || {};

        if (quotaBytes !== undefined) {
            if (!Number.isFinite(quotaBytes) || quotaBytes < 100 * 1024 * 1024) {
                throw new ValidationError('quotaBytes must be at least 100 MB', {
                    quotaBytes
                });
            }
            mediaService.setQuota(quotaBytes);
        }

        if (ttlDays !== undefined) {
            if (!Number.isFinite(ttlDays) || ttlDays < 1) {
                throw new ValidationError('ttlDays must be at least 1', { ttlDays });
            }
            mediaService.setTTL(ttlDays);
        }

        // Return updated stats
        const stats = mediaService.getStats();

        res.json({
            success: true,
            message: 'Cache settings updated',
            settings: {
                quotaBytes: stats.quota,
                quotaMB: stats.quotaMB,
                ttlDays: stats.ttlDays
            }
        });
    }));
}