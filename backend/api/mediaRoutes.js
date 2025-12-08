/**
 * api/mediaRoutes.js
 * ------------------
 * Media serving endpoints for cached photos.
 *
 * Provides two URL patterns with different LRU behavior:
 * - /api/player/media/:id/:kind - Player interface (touches LRU)
 * - /api/media/:id/:kind - Management interface (no LRU touch)
 *
 * This separation prevents management UI browsing from evicting
 * photos actively displayed on player devices.
 *
 * Note: Cache management endpoints (stats, eviction, settings) are in
 * cacheSettingsRoutes.js to maintain separation of concerns.
 */

import express from 'express';
import * as mediaService from '../services/mediaService.js';
import * as photoRepo from '../db/photoRepo.js';
import { asyncHandler, errorMapper } from '../utils/errorMapper.js';
import { NotFoundError, ValidationError } from '../modules/errors.js';

/**
 * Core media serving handler.
 * Tries to serve from cache, falls back to CDN redirect.
 * Optionally triggers background caching for missing files.
 *
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {string} kind - Media type ('preview' or 'original')
 * @param {string} source - Access source ('player' or 'management')
 */
async function serveMedia(req, res, kind, source) {
    const { statusId } = req.params;

    if (!statusId) {
        throw new ValidationError('status_id is required');
    }

    if (!['preview', 'original'].includes(kind)) {
        throw new ValidationError('kind must be "preview" or "original"', { kind });
    }

    // 1. Try to serve from cache
    const shouldTouch = source === 'player';
    const cached = await mediaService.getCachedPath(statusId, kind, {
        touch: shouldTouch
    });

    if (cached && cached.exists) {
        // Serve from disk with appropriate headers
        return res.sendFile(cached.path, {
            headers: {
                'Cache-Control': 'public, max-age=31536000', // 1 year (immutable content)
                'X-Cache': 'HIT',
                'X-Source': source
            }
        });
    }

    // 2. Not cached - need to get remote URL from photo metadata
    const photos = photoRepo.getMany([statusId]);

    if (!photos || photos.length === 0) {
        throw new NotFoundError('Photo not found', { statusId });
    }

    const photo = photos[0];
    const remoteUrl = kind === 'preview' ? photo.preview_url : photo.url;

    if (!remoteUrl) {
        throw new NotFoundError(`No ${kind} URL available for photo`, {
            statusId,
            kind
        });
    }

    // 3. Redirect to CDN (302 temporary redirect)
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Source', source);
    res.redirect(302, remoteUrl);

    // 4. OPTIONAL: Trigger background cache (fire and forget)
    // Only cache on player access to avoid polluting cache from management browsing
    if (source === 'player') {
        mediaService.cacheMedia(photo, kind, { skipIfExists: true })
            .catch(err => {
                console.warn(`[Media] Background cache failed for ${statusId}/${kind}:`, err.message);
            });
    }
}

export default function mountMediaRoutes(app) {
    const playerRouter = express.Router();
    const mediaRouter = express.Router();

    // =============================================================================
    // PLAYER MEDIA ROUTES (touch LRU)
    // =============================================================================

    /**
     * GET /api/player/media/:statusId/preview
     * Serve preview image for player display.
     * Updates last_accessed_at (LRU tracking).
     */
    playerRouter.get('/media/:statusId/preview', asyncHandler(async (req, res) => {
        await serveMedia(req, res, 'preview', 'player');
    }));

    /**
     * GET /api/player/media/:statusId/original
     * Serve original image for player display.
     * Updates last_accessed_at (LRU tracking).
     */
    playerRouter.get('/media/:statusId/original', asyncHandler(async (req, res) => {
        await serveMedia(req, res, 'original', 'player');
    }));

    // =============================================================================
    // MANAGEMENT MEDIA ROUTES (no LRU touch)
    // =============================================================================

    /**
     * GET /api/media/:statusId/preview
     * Serve preview image for management interface.
     * Does NOT update last_accessed_at.
     */
    mediaRouter.get('/:statusId/preview', asyncHandler(async (req, res) => {
        await serveMedia(req, res, 'preview', 'management');
    }));

    /**
     * GET /api/media/:statusId/original
     * Serve original image for management interface.
     * Does NOT update last_accessed_at.
     */
    mediaRouter.get('/:statusId/original', asyncHandler(async (req, res) => {
        await serveMedia(req, res, 'original', 'management');
    }));

    // Mount routers
    app.use('/api/player', playerRouter);
    app.use('/api/media', mediaRouter);

    // Error handling
    playerRouter.use(errorMapper);
    mediaRouter.use(errorMapper);
}