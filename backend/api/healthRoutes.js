// backend/api/healthRoutes.js
// Health check endpoint for PixelFree backend.
// Provides a simple JSON response describing current system health.

import express from 'express';
import { getHealth } from '../modules/health.js';

// tiny async wrapper so we don’t depend on external asyncHandler
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export default function mountHealthRoutes(app) {
  const router = express.Router();

  // GET /api/health
  router.get('/health', wrap(async (_req, res) => {
    console.log('[API] GET /api/health');
    const health = await getHealth();
    res.json(health);
  }));

  // Mount under /api
  app.use('/api', router);
}