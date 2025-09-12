// backend/api/cacheSettingsRoutes.js

import express from 'express';
import * as cache from '../modules/cache.js';
import * as settings from '../modules/settings.js';

// tiny async wrapper (no external dependency)
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export default function mountCacheSettingsRoutes(app) {
  const router = express.Router();

  // ---- Cache ----
  // GET /api/cache/clear
  router.get('/cache/clear', wrap(async (_req, res) => {
    console.log('[API] GET /api/cache/clear');
    await cache.clearCache();
    res.json({ status: 'Cache cleared' });
  }));

  // ---- Settings ----
  // GET /api/settings
  router.get('/settings', (_req, res) => {
    console.log('[API] GET /api/settings');
    res.json(settings.getSettings());
  });

  // POST /api/settings
  router.post('/settings', (req, res) => {
    console.log('[API] POST /api/settings', req.body);
    settings.updateSettings(req.body || {});
    res.json({ status: 'Settings updated' });
  });

  // Mount under /api
  app.use('/api', router);
}