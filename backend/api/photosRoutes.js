// backend/api/photosRoutes.js
// Advanced multi-source query and legacy/simple photos endpoints
// Uses router-level error middleware (errorMapper) for consistent error handling.

import express from 'express';
import * as photoFetcher from '../services/photoFetcher.js';
import { resolveAccountId } from '../modules/accounts.js';
import { ValidationError } from '../modules/errors.js';
import * as settings from '../modules/settings.js';
import { errorMapper } from '../utils/errorMapper.js';

// tiny async wrapper to forward errors to Express
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export default function mountPhotosRoutes(app) {
  const router = express.Router();

  // -------------------------------
  // POST /api/photos/query
  // Advanced multi-source query (tags/users with OR + AND + tagmode any|all)
  // -------------------------------
  router.post('/query', wrap(async (req, res) => {
    const body = req.body || {};
    const limitRaw = Number(body.limit);
    const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? limitRaw : 20, 40));

    // ---- TAGS ONLY ----
    if (body.type === 'tag') {
      const tags = Array.from(new Set((body.tags || [])
        .map(s => String(s).replace(/^#/, '').trim())
        .filter(Boolean)));
      if (!tags.length) throw new ValidationError('tags required');

      const tagmode = String(body.tagmode || 'any').toLowerCase(); // 'any' | 'all'
      const photos = await photoFetcher.getLatestPhotosForTags(tags, { limit, tagmode });
      return res.json(photos);
    }

    // ---- USERS ONLY ----
    if (body.type === 'user') {
      const providedIds = Array.isArray(body.accountIds) ? body.accountIds : [];
      const accts = Array.isArray(body.accts) ? body.accts : [];
      const errors = [];
      const ids = providedIds.slice();

      for (const a of accts) {
        try {
          const id = await resolveAccountId(a);
          if (id) ids.push(id);
        } catch (e) {
          errors.push({ target: a, code: e.code || 'error', message: e.message });
        }
      }

      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      if (!uniqueIds.length) throw new ValidationError('users required');

      const photos = await photoFetcher.getLatestPhotosForUsers(uniqueIds, { limit });
      return errors.length ? res.json({ photos, errors }) : res.json(photos);
    }

    // ---- COMPOUND (tags + users) ----
    if (body.type === 'compound') {
      const tags = Array.from(new Set((body.tags || [])
        .map(s => String(s).replace(/^#/, '').trim())
        .filter(Boolean)));

      // Users can come as acct strings or as accountIds
      const userAccts = Array.isArray(body.users?.accts) ? body.users.accts : [];
      const userIdsIn = Array.isArray(body.users?.accountIds) ? body.users.accountIds : [];

      const errors = [];
      const ids = userIdsIn.slice();

      // Resolve accts → ids with partial error collection
      for (const a of userAccts) {
        try {
          const id = await resolveAccountId(a);
          if (id) ids.push(id);
        } catch (e) {
          errors.push({ target: a, code: e.code || 'error', message: e.message });
        }
      }

      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      if (!tags.length && !uniqueIds.length) {
        throw new ValidationError('tags or users required');
      }

      const tagmode = String(body.tagmode || 'any').toLowerCase(); // 'any' | 'all'
      const photos = await photoFetcher.getLatestPhotosCompound(
        { tags, accountIds: uniqueIds },
        { limit, tagmode }
      );
      return errors.length ? res.json({ photos, errors }) : res.json(photos);
    }

    throw new ValidationError('unsupported query type', { type: body.type });
  }));

  // -------------------------------
  // GET /api/photos (legacy/simple)
  // -------------------------------
  router.get('/', wrap(async (req, res) => {
    console.log('[API] GET /api/photos', req.query);

    const cfg = settings.getSettings();
    let source = cfg.source; // default (e.g., tag)
    const limit = Math.min(Number(req.query.limit) || (cfg.sync?.fetchLimit ?? 20), 40);
    const type = String(req.query.type || '').trim();

    if (type === 'tag' && typeof req.query.tag === 'string') {
      source = { type: 'tag', tag: req.query.tag.trim() };
    } else if (type === 'public') {
      source = { type: 'public', localOnly: String(req.query.localOnly) === 'true' };
    } else if (type === 'user') {
      let accountId = req.query.accountId && String(req.query.accountId).trim();
      const acct = req.query.acct && String(req.query.acct).trim();

      if (!accountId) {
        if (!acct) {
          throw new ValidationError('For type=user, provide accountId or acct.');
        }
        // resolveAccountId now throws typed errors which bubble to errorMapper
        accountId = await resolveAccountId(acct);
      }
      source = { type: 'user', accountId };
    }

    // fetchPhotos is the legacy/simple fetch function
    const photos = await photoFetcher.fetchPhotos({ limit, source });
    res.json(photos);
  }));

  // Use the shared error middleware for this router
  router.use(errorMapper);

  // Mount under /api/photos
  app.use('/api/photos', router);
}