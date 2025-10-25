// backend/api/favoritesRoutes.js
// Routes for managing user favorites.

import express from 'express';
import * as favoritesRepo from '../db/favoritesRepo.js';
import * as photoRepo from '../db/photoRepo.js';
import { ensureAuthed } from '../utils/authMiddleware.js';
import { ValidationError } from '../modules/errors.js';
import {mapPhotoRow} from "../utils/helpers.js";

// TODO: consider adding batch endpoints
// TODO: use error module for errors

export default function mountFavoritesRoutes(app) {
    const router = express.Router();

    // All fav routes require auth
    router.use(ensureAuthed);

    // Helper: clamp values between min and max
    const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

    // POST /api/favorites/:statusId
    // Add a photo to favorites
    router.post('/:statusId', (req, res) => {
        try {
            const statusId = req.params.statusId;
            if (!Number.isFinite(statusId)) {
                return res.status(400).json({
                    error: {
                        code: 'BadRequest',
                        message: 'statusId must be a positive integer'
                    }
                });
            }
            const {note} = req.body || {};

            // Check if photo exists in photos table
            const photos = photoRepo.getMany([statusId]);
            if (!photos || photos.length === 0) {
                return res.status(400).json({
                    error: {
                        code: 'NotFound',
                        message: 'photo not found'
                    }
                });
            }

            const result = favoritesRepo.addFavorite(statusId, note || null);
            console.log(`[Favorites] Added ${statusId} to favorites`);
            res.status(201).json({
                statusId: result.statusId,
                favorited_at: result.favorited_at,
                note: result.note,
                is_favorited: true
            });
        } catch (error) {
            console.error('[API] Add favorite failed:', e);
            res.status(500).json({
                error: {
                    code: 'InternalError',
                    message: 'Failed to add favorite'
                }
            });
        }
    });

    // DELETE /api/favorites/:statusId
    // Remove a photo from favorites
    router.delete('/:statusId', (req, res) => {
        try {
            const statusId = req.params.statusId;
            if (!Number.isFinite(statusId)) {
                return res.status(400).json({
                    error: {
                        code: 'BadRequest',
                        message: 'statusId must be a positive integer'
                    }
                });
            }
            const removed = favoritesRepo.removeFavorite(statusId);
            if(!removed) {
                return res.status(404).json({
                    error: {
                        code: 'NotFound',
                        message: 'Photo not in favorites'
                    }
                });
            }
            console.log(`[Favorites] Removed ${statusId} from favorites`);
            res.status(204).end();
        } catch (error) {
            console.error('Remove favorite failed:', error);
            res.status(500).json({
                error: {
                    code: 'InternalError',
                    message: 'Failed to remove favorite'
                }
            });
        }
    });

    // GET /api/favorites/:statusId
    // Get a photo's favorites status
    router.get('/:statusId', (req, res) => {
        try {
            const statusId = req.params.statusId;
            if (!Number.isFinite(statusId)) {
                return res.status(400).json({
                    error: {
                        code: 'BadRequest',
                        message: 'statusId must be a positive integer'
                    }
                })
            }
            const favorite = favoritesRepo.getFavorite(statusId);
            if(!favorite) {
                return res.json({
                    statusId,
                    is_favorited: false
                });
            }
            res.json({
                statusId: favorite.status_id,
                favorited_at: favorite.favorited_at,
                note: favorite.note,
                is_favorited: true
            });
        } catch (error) {
            console.error('Get favorite failed:', error);
            res.status(500).json({
                error: {
                    code: 'InternalError',
                    message: 'Failed to get favorite'
                }
            });
        }
    })
// POST /api/favorites/batch/check
    // Check favorite status for multiple photos
    router.post('/batch/check', (req, res) => {
        try {
            const { statusIds } = req.body;

            if (!Array.isArray(statusIds)) {
                return res.status(400).json({
                    error: {
                        code: 'BadRequest',
                        message: 'statusIds must be an array'
                    }
                });
            }

            if (statusIds.length === 0) {
                return res.json({ favorites: {} });
            }

            if (statusIds.length > 100) {
                return res.status(400).json({
                    error: {
                        code: 'BadRequest',
                        message: 'Cannot check more than 100 items at once'
                    }
                });
            }

            const statusMap = favoritesRepo.checkFavoritesStatus(statusIds);
            console.log(`[Favorites] Checked ${statusIds.length} favorites`);

            res.json({ favorites: statusMap });
        } catch (error) {
            console.error('Batch check favorites failed:', error);
            res.status(500).json({
                error: {
                    code: 'InternalError',
                    message: 'Failed to check favorites'
                }
            });
        }
    });

    // POST /api/favorites/batch/get
    // Get favorite metadata for multiple photos
    router.post('/batch/get', (req, res) => {
        try {
            const { statusIds } = req.body;

            if (!Array.isArray(statusIds)) {
                return res.status(400).json({
                    error: {
                        code: 'BadRequest',
                        message: 'statusIds must be an array'
                    }
                });
            }

            if (statusIds.length === 0) {
                return res.json({ favorites: [] });
            }

            if (statusIds.length > 100) {
                return res.status(400).json({
                    error: {
                        code: 'BadRequest',
                        message: 'Cannot get more than 100 items at once'
                    }
                });
            }

            const favorites = favoritesRepo.getFavorites(statusIds);
            console.log(`[Favorites] Retrieved ${favorites.length} favorites`);

            res.json({
                favorites: favorites.map(f => ({
                    statusId: f.status_id,
                    favorited_at: f.favorited_at,
                    note: f.note,
                    is_favorited: true
                }))
            });
        } catch (error) {
            console.error('Batch get favorites failed:', error);
            res.status(500).json({
                error: {
                    code: 'InternalError',
                    message: 'Failed to get favorites'
                }
            });
        }
    });

    // POST /api/favorites/batch/add
    // Add multiple photos to favorites
    router.post('/batch/add', (req, res) => {
        try {
            const { items } = req.body;

            if (!Array.isArray(items)) {
                return res.status(400).json({
                    error: {
                        code: 'BadRequest',
                        message: 'items must be an array'
                    }
                });
            }

            if (items.length === 0) {
                return res.json({ results: [] });
            }

            if (items.length > 50) {
                return res.status(400).json({
                    error: {
                        code: 'BadRequest',
                        message: 'Cannot add more than 50 items at once'
                    }
                });
            }

            // Validate all items have statusId
            for (const item of items) {
                if (!item.statusId) {
                    return res.status(400).json({
                        error: {
                            code: 'BadRequest',
                            message: 'Each item must have a statusId'
                        }
                    });
                }
            }

            // Check if all photos exist
            const statusIds = items.map(item => item.statusId);
            const photos = photoRepo.getMany(statusIds);
            const photoIds = new Set(photos.map(p => p.status_id));

            const results = [];
            const validItems = [];

            for (const item of items) {
                if (!photoIds.has(item.statusId)) {
                    results.push({
                        statusId: item.statusId,
                        success: false,
                        error: 'Photo not found'
                    });
                } else {
                    validItems.push(item);
                }
            }

            if (validItems.length > 0) {
                const addResults = favoritesRepo.addFavorites(validItems);
                results.push(...addResults.map(r => ({
                    statusId: r.statusId,
                    favorited_at: r.favorited_at,
                    note: r.note,
                    success: r.success,
                    error: r.error,
                    is_favorited: r.success
                })));
            }

            const successCount = results.filter(r => r.success).length;
            console.log(`[Favorites] Batch added ${successCount}/${items.length} favorites`);

            res.status(201).json({ results });
        } catch (error) {
            console.error('Batch add favorites failed:', error);
            res.status(500).json({
                error: {
                    code: 'InternalError',
                    message: 'Failed to add favorites'
                }
            });
        }
    });

    // POST /api/favorites/batch/remove
    // Remove multiple photos from favorites
    router.post('/batch/remove', (req, res) => {
        try {
            const { statusIds } = req.body;

            if (!Array.isArray(statusIds)) {
                return res.status(400).json({
                    error: {
                        code: 'BadRequest',
                        message: 'statusIds must be an array'
                    }
                });
            }

            if (statusIds.length === 0) {
                return res.json({ results: [] });
            }

            if (statusIds.length > 50) {
                return res.status(400).json({
                    error: {
                        code: 'BadRequest',
                        message: 'Cannot remove more than 50 items at once'
                    }
                });
            }

            const results = favoritesRepo.removeFavorites(statusIds);
            const successCount = results.filter(r => r.success).length;

            console.log(`[Favorites] Batch removed ${successCount}/${statusIds.length} favorites`);

            res.json({ results });
        } catch (error) {
            console.error('Batch remove favorites failed:', error);
            res.status(500).json({
                error: {
                    code: 'InternalError',
                    message: 'Failed to remove favorites'
                }
            });
        }
    });
    // GET /api/favorites
    // List all favorited photos
    router.get('/', (req, res) => {
        try {
            const offset = clamp(Number(req.query.offset ?? 0), 0, 100_000);
            const limit = clamp(Number(req.query.limit ?? 20), 1, 100);
            const result = favoritesRepo.listFavorites({ offset, limit });
            const items = result.items.map(mapPhotoRow);

            console.log(`[Favorites] Listed ${items.length} favorites (offset=${offset}, limit=${limit})`);
            res.json({
                items,
                total: result.total,
                offset: result.offset,
                limit: result.limit
            })
        } catch (error) {
            console.error('List favorites failed:', error);
            res.status(500).json({
                error: {
                    code: 'InternalError',
                    message: 'Failed to list favorites'
                }
            })
        }
    })
}
