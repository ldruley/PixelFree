// backend/api/favoritesRoutes.js
// Routes for managing user favorites.

import express from 'express';
import * as favoritesRepo from '../db/favoritesRepo.js';
import * as photoRepo from '../db/photoRepo.js';
import { ensureAuthed } from '../utils/authMiddleware.js';
import { ValidationError, NotFoundError } from '../modules/errors.js';
import { asyncHandler, errorMapper } from '../utils/errorMapper.js';
import { mapPhotoRow } from '../utils/helpers.js';

// TODO: consider adding batch endpoints

export default function mountFavoritesRoutes(app) {
    const router = express.Router();

    // All fav routes require auth
    router.use(ensureAuthed);

    // Helper: clamp values between min and max
    const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

    // POST /api/favorites/:statusId
    // Add a photo to favorites
    router.post('/:statusId', asyncHandler(async (req, res) => {
        const statusId = req.params.statusId;

        // Validate statusId format
        if (!statusId || typeof statusId !== 'string' || !statusId.trim()) {
            throw new ValidationError('statusId is required and must be a non-empty string');
        }

        const { note } = req.body || {};

        // Check if photo exists in photos table
        const photos = photoRepo.getMany([statusId]);
        if (!photos || photos.length === 0) {
            throw new NotFoundError('Photo not found', { statusId });
        }

        const result = favoritesRepo.addFavorite(statusId, note || null);
        console.log(`[Favorites] Added ${statusId} to favorites`);

        res.status(201).json({
            statusId: result.statusId,
            favorited_at: result.favorited_at,
            note: result.note,
            is_favorited: true
        });
    }));

    // DELETE /api/favorites/:statusId
    // Remove a photo from favorites
    router.delete('/:statusId', asyncHandler(async (req, res) => {
        const statusId = req.params.statusId;

        // Validate statusId format
        if (!statusId || typeof statusId !== 'string' || !statusId.trim()) {
            throw new ValidationError('statusId is required and must be a non-empty string');
        }

        const removed = favoritesRepo.removeFavorite(statusId);
        if (!removed) {
            throw new NotFoundError('Photo not in favorites', { statusId });
        }

        console.log(`[Favorites] Removed ${statusId} from favorites`);
        res.status(204).end();
    }));

    // GET /api/favorites/:statusId
    // Get a photo's favorites status
    router.get('/:statusId', asyncHandler(async (req, res) => {
        const statusId = req.params.statusId;

        // Validate statusId format
        if (!statusId || typeof statusId !== 'string' || !statusId.trim()) {
            throw new ValidationError('statusId is required and must be a non-empty string');
        }

        const favorite = favoritesRepo.getFavorite(statusId);
        if (!favorite) {
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
    }));

    // GET /api/favorites
    // List all favorited photos
    router.get('/', asyncHandler(async (req, res) => {
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
        });
    }));

    // Apply error mapper middleware to this router
    router.use(errorMapper);

    app.use('/api/favorites', router);
}