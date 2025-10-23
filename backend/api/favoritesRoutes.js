// backend/api/favoritesRoutes.js
// Routes for managing user favorites.

import express from 'express';
import * as favoritesRepo from '../db/favoritesRepo.js';
import * as photoRepo from '../db/photoRepo.js';
import { ensureAuthed } from '../utils/authMiddleware.js';
import { ValidationError } from '../modules/errors.js';
import {mapPhotoRow} from "./albumsRoutes.js";

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
            const statusID = Number(req.params.statusId);
            if (!Number.isFinite(statusID)) {
                return res.status(400).json({
                    error: {
                        code: 'BadRequest',
                        message: 'statusId must be a positive integer'
                    }
                });
            }
            const {note} = req.body || {};

            // Check if photo exists in photos table
            const photos = photoRepo.getMany([statusID]);
            if (!photos || photos.length === 0) {
                return res.status(400).json({
                    error: {
                        code: 'NotFound',
                        message: 'photo not found'
                    }
                });
            }

            const result = favoritesRepo.addFavorite(statusID, note || null);
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
            const statusID = Number(req.params.statusId);
            if (!Number.isFinite(statusID)) {
                return res.status(400).json({
                    error: {
                        code: 'BadRequest',
                        message: 'statusId must be a positive integer'
                    }
                });
            }
            const removed = favoritesRepo.removeFavorite(statusID);
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
            const statusId = Number(req.params.statusId);
            if (!Number.isFinite(statusID)) {
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
