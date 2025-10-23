// backend/api/favoritesRoutes.js
// Routes for managing user favorites.

import express from 'express';
import * as favoritesRepo from '../db/favoritesRepo.js';
import * as photoRepo from '../db/photoRepo.js';
import { ensureAuthed } from '../utils/authMiddleware.js';
import { ValidationError } from '../modules/errors.js';

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
                return res.status(400).json({ error: 'statusId must be a positive integer' });
            }
            const {note} = req.body || {};

            // Check if photo exists in photos table
            const photos = photoRepo.getMany([statusID]);
            if (!photos || photos.length === 0) {
                return res.status(400).json({ error: 'photo not found' });
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


}
