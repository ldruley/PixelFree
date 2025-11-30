// backend/api/settingsRoutes.js
// REST API endpoints for managing settings
//
// Supports both frontend UI settings and player (photo frame) display settings
// Settings are stored in the KV table as namespaced JSON blobs

import express from 'express';
import { asyncHandler } from '../utils/errorMapper.js';
import * as settingsService from '../services/settingsService.js';

export default function mountSettingsRoutes(app) {
    const router = express.Router();

// ============================================================================
// Admin Frontend Settings Endpoints
// ============================================================================

/**
 * GET /api/settings/frontend
 * List all frontend settings
 */
router.get('/frontend', asyncHandler(async (req, res) => {
    const settings = settingsService.listFrontendSettings();
    res.json({
        settings,
        count: settings.length
    });
}));

/**
 * GET /api/settings/frontend/:key
 * Get a specific frontend setting by key
 */
router.get('/frontend/:key', asyncHandler(async (req, res) => {
    const { key } = req.params;
    const settings = settingsService.getFrontendSettings(key);

    if (settings === null) {
        return res.status(404).json({
            error: {
                code: 'NotFoundError',
                message: `Frontend settings not found for key: ${key}`
            }
        });
    }

    res.json({ key, settings });
}));

/**
 * PUT /api/settings/frontend/:key
 * Create or update frontend settings for a key
 *
 * Body: { [any JSON object] }
 */
router.put('/frontend/:key', asyncHandler(async (req, res) => {
    const { key } = req.params;
    const settings = req.body;

    settingsService.setFrontendSettings(key, settings);

    res.json({
        key,
        settings,
        message: 'Frontend settings saved'
    });
}));

/**
 * DELETE /api/settings/frontend/:key
 * Delete frontend settings for a key
 */
router.delete('/frontend/:key', asyncHandler(async (req, res) => {
    const { key } = req.params;
    const removed = settingsService.removeFrontendSettings(key);

    if (!removed) {
        return res.status(404).json({
            error: {
                code: 'NotFoundError',
                message: `Frontend settings not found for key: ${key}`
            }
        });
    }

    res.status(204).send();
}));

// ============================================================================
// Player Settings Endpoints
// ============================================================================

/**
 * GET /api/settings/player
 * Get player (photo frame) display settings
 * Returns merged defaults + saved settings
 */
router.get('/player', asyncHandler(async (req, res) => {
    const settings = settingsService.getPlayerSettings();
    res.json({ settings });
}));

/**
 * PATCH /api/settings/player
 * Update player settings (partial update)
 *
 * Body example:
 * {
 *   "layout": "grid",
 *   "timing": "30s",
 *   "activeAlbum": "vacation-2024"
 * }
 */
router.patch('/player', asyncHandler(async (req, res) => {
    const updates = req.body;
    const settings = settingsService.updatePlayerSettings(updates);

    res.json({
        settings,
        message: 'Player settings updated'
    });
}));

/**
 * PUT /api/settings/player
 * Replace all player settings
 * Use PATCH for partial updates; this endpoint is for complete replacement
 */
router.put('/player', asyncHandler(async (req, res) => {
    const newSettings = req.body;

    // Validate all settings at once
    const settings = settingsService.updatePlayerSettings(newSettings);

    res.json({
        settings,
        message: 'Player settings replaced'
    });
}));

/**
 * POST /api/settings/player/reset
 * Reset player settings to defaults
 */
router.post('/player/reset', asyncHandler(async (req, res) => {
    const settings = settingsService.resetPlayerSettings();

    res.json({
        settings,
        message: 'Player settings reset to defaults'
    });
}));

// ============================================================================
// Player State Endpoints (runtime playback information)
// ============================================================================

/**
 * GET /api/settings/player/state
 * Get current player state (what's playing, current photo, etc.)
 * Used by photo frame to sync state or by management UI to monitor playback
 */
router.get('/player/state', asyncHandler(async (req, res) => {
    const state = settingsService.getPlayerState();

    if (state === null) {
        return res.json({
            state: null,
            message: 'No active player state'
        });
    }

    res.json({ state });
}));

/**
 * PUT /api/settings/player/state
 * Update player state
 *
 * Body example:
 * {
 *   "currentPhotoId": "status_12345",
 *   "currentAlbum": "favorites",
 *   "photoIndex": 5,
 *   "totalPhotos": 42,
 *   "isPlaying": true
 * }
 */
router.put('/player/state', asyncHandler(async (req, res) => {
    const stateUpdate = req.body;
    const state = settingsService.updatePlayerState(stateUpdate);

    res.json({
        state,
        message: 'Player state updated'
    });
}));

    /**
     * DELETE /api/settings/player/state
     * Clear player state (e.g., when player stops)
     */
    router.delete('/player/state', asyncHandler(async (req, res) => {
        const removed = settingsService.remove('player-state', 'current');

        if (!removed) {
            return res.status(404).json({
                error: {
                    code: 'NotFoundError',
                    message: 'No player state to clear'
                }
            });
        }

        res.status(204).send();
    }));

// Mount under /api/settings
    app.use('/api/settings', router);
}