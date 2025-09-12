// backend/api/albumsRoutes.js
// Express routes for Virtual Albums (create/list/get/update/toggle/delete/refresh + photos)

import express from 'express';
import * as photoFetcher from '../services/photoFetcher.js';
import * as albumRepo from '../db/albumRepo.js';
import * as photoRepo from '../db/photoRepo.js';
import { ensureAuthed } from '../utils/authMiddleware.js';

export default function mountAlbumRoutes(app) {
  const router = express.Router();
  router.use(ensureAuthed);

  // -----------------------------
  // Helpers
  // -----------------------------
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  function normalizeTags(tags) {
    if (!Array.isArray(tags)) return undefined;
    return tags
      .map(t => String(t || '').trim())
      .filter(Boolean)
      .map(t => t.replace(/^#/, '').toLowerCase());
  }

  function parseUsers(users) {
    if (!users) return undefined;
    // Accept either { accts:[], ids:[] } or a flat array of accts
    if (Array.isArray(users)) return { accts: users.map(String) };
    const out = {};
    if (Array.isArray(users.accts)) out.accts = users.accts.map(String);
    if (Array.isArray(users.ids)) out.ids = users.ids.map(String);
    return (out.accts?.length || out.ids?.length) ? out : undefined;
  }

  function shapeAlbumOut(row) {
    // albumRepo.get/list currently returns raw row; expose a consistent shape
    const refresh = row.refresh_json ? JSON.parse(row.refresh_json) : {};
    return {
      id: row.id,
      name: row.name,
      created_at: row.created_at,
      updated_at: row.updated_at,
      enabled: !!row.enabled,
      query: {
        type: row.query_type,
        tags: row.query_tags ? JSON.parse(row.query_tags) : undefined,
        users: row.query_users ? JSON.parse(row.query_users) : undefined,
        tagmode: row.query_tagmode,
        limit: row.query_limit
      },
      refresh,
      // lightweight stats: call only when needed (list endpoint also wants total)
    };
  }

  function mapPhotoRow(row) {
    // tags_json → tags[]
    let tags = [];
    if (row?.tags_json) {
      try {
        const arr = JSON.parse(row.tags_json);
        if (Array.isArray(arr)) tags = arr;
      } catch (_) { /* ignore */ }
    }

    // Shape to the same contract used by /api/photos/query
    return {
      id: row.status_id,           // keep both for convenience
      status_id: row.status_id,
      created_at: row.created_at || null,

      author: {
        id: row.author_id ?? null,
        acct: row.author_acct ?? null,
        username: row.author_username ?? null,
        display_name: row.author_display ?? null,
        avatar: row.author_avatar ?? null,
      },
      author_display_name: row.author_display ?? null,

      caption: row.caption_html ?? null,  // your client uses captionHtml OR content
      post_url: row.post_url ?? null,

      tags,                              // normalized array

      url: row.url ?? null,
      preview_url: row.preview_url ?? row.url ?? null,

      // If you later left-join a media manifest, map to local_path here
      local_path: row.local_path ?? null
    };
  }

  function validateQuery(q = {}) {
    const type = q.type;
    if (!['tag', 'user', 'compound'].includes(type || '')) {
      return 'query.type must be "tag" | "user" | "compound"';
    }
    const tagmode = q.tagmode || 'any';
    if (!['any', 'all'].includes(tagmode)) {
      return 'query.tagmode must be "any" | "all"';
    }
    const limit = q.limit == null ? 20 : Number(q.limit);
    if (!Number.isFinite(limit) || limit < 1 || limit > 40) {
      return 'query.limit must be an integer between 1 and 40';
    }
    if (type === 'tag') {
      const tags = normalizeTags(q.tags);
      if (!tags?.length) return 'query.tags must be a non-empty array for type "tag"';
    }
    if (type === 'user') {
      const users = parseUsers(q.users ?? q); // allow { accts:[] } or { users:{...} }
      if (!users) return 'query.users must include accts[] and/or ids[] for type "user"';
    }
    if (type === 'compound') {
      const tags = normalizeTags(q.tags);
      const users = parseUsers(q.users);
      if (!tags?.length) return 'compound query requires non-empty tags[]';
      if (!users) return 'compound query requires users.accts[] and/or users.ids[]';
    }
    return null;
  }

  // Small helpers (local)
  function parseJsonArray(s) {
    if (!s) return [];
    try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
  }

  function inferType(row) {
    if (row?.query_type) return String(row.query_type);
    const tags = parseJsonArray(row?.query_tags);
    const users = parseJsonArray(row?.query_users);
    if (tags.length && users.length) return 'compound';
    if (tags.length) return 'tag';
    if (users.length) return 'user';
    return 'tag';
  }

  // -----------------------------
  // Routes
  // -----------------------------

  // Create album
  router.post('/', (req, res) => {
    try {
      const { name, query = {}, refresh = {}, enabled = true } = req.body || {};
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: { code: 'ValidationError', message: 'name is required' } });
      }
      // normalize/validate query
      const nq = {
        type: query.type,
        tags: normalizeTags(query.tags),
        users: parseUsers(query.users),
        tagmode: query.tagmode || 'any',
        limit: clamp(Number(query.limit ?? 20), 1, 40)
      };
      const err = validateQuery(nq);
      if (err) return res.status(400).json({ error: { code: 'ValidationError', message: err } });

      const row = albumRepo.create({
        name,
        query: nq,
        refresh: {
          intervalMs: Number(refresh.intervalMs ?? 600000),
          last_checked_at: null,
          backoff_until: null,
          since_id: null,
          max_id: null
        },
        enabled: !!enabled
      });

      // Add stats.total (count album_items)
      const { total } = albumRepo.listItems(row.id, { limit: 1, offset: 0 });
      res.status(201).json({ ...shapeAlbumOut(row), stats: { total } });
    } catch (e) {
      console.error('Create album failed:', e);
      res.status(500).json({ error: { code: 'InternalError', message: 'failed to create album' } });
    }
  });

  // Get album by id
  router.get('/:id', (req, res) => {
    try {
      const row = albumRepo.get(req.params.id);
      if (!row) return res.status(404).json({ error: { code: 'NotFound', message: 'album not found' } });
      const shaped = shapeAlbumOut(row);
      const { total } = albumRepo.listItems(row.id, { limit: 1, offset: 0 });
      res.json({ ...shaped, stats: { total } });
    } catch (e) {
      console.error('Get album failed:', e);
      res.status(500).json({ error: { code: 'InternalError', message: 'failed to get album' } });
    }
  });

  // List albums
  router.get('/', (req, res) => {
    try {
      const offset = clamp(Number(req.query.offset ?? 0), 0, 10_000_000);
      const limit = clamp(Number(req.query.limit ?? 20), 1, 100);
      const enabledParam = req.query.enabled;
      const enabled = enabledParam == null ? undefined : (String(enabledParam).toLowerCase() === 'true');

      const { items, total } = albumRepo.list({ offset, limit, enabled });
      res.json({
        items: items.map(shapeAlbumOut).map(a => {
          const { total: t } = albumRepo.listItems(a.id, { limit: 1, offset: 0 });
          return { ...a, stats: { total: t } };
        }),
        total, offset, limit
      });
    } catch (e) {
      console.error('List albums failed:', e);
      res.status(500).json({ error: { code: 'InternalError', message: 'failed to list albums' } });
    }
  });

  // Update album (name/query/refresh/enabled)
  router.patch('/:id', (req, res) => {
    try {
      const id = req.params.id;
      const patch = {};
      const { name, enabled, query, refresh } = req.body || {};

      if (name != null) patch.name = String(name);
      if (enabled != null) patch.enabled = !!enabled;

      if (query) {
        const nq = {
          type: query.type ?? undefined,
          tags: query.tags != null ? normalizeTags(query.tags) : undefined,
          users: query.users != null ? parseUsers(query.users) : undefined,
          tagmode: query.tagmode ?? undefined,
          limit: query.limit != null ? clamp(Number(query.limit), 1, 40) : undefined
        };
        const err = validateQuery({ ...nq, type: nq.type ?? (albumRepo.get(id)?.query_type) });
        if (err && nq.type) { // only strict-validate if type is being changed/set explicitly
          return res.status(400).json({ error: { code: 'ValidationError', message: err } });
        }
        patch.query = nq;
      }

      if (refresh) {
        patch.refresh = {};
        if (refresh.intervalMs != null) patch.refresh.intervalMs = Number(refresh.intervalMs);
        if (refresh.since_id != null) patch.refresh.since_id = String(refresh.since_id);
        if (refresh.max_id != null) patch.refresh.max_id = String(refresh.max_id);
        if (refresh.backoff_until != null) patch.refresh.backoff_until = String(refresh.backoff_until);
        if (refresh.last_checked_at != null) patch.refresh.last_checked_at = String(refresh.last_checked_at);
      }

      const updated = albumRepo.update(id, patch);
      if (!updated) return res.status(404).json({ error: { code: 'NotFound', message: 'album not found' } });

      const shaped = shapeAlbumOut(updated);
      const { total } = albumRepo.listItems(id, { limit: 1, offset: 0 });
      res.json({ ...shaped, stats: { total } });
    } catch (e) {
      console.error('Update album failed:', e);
      if (String(e?.message).includes('AlbumNotFound')) {
        return res.status(404).json({ error: { code: 'NotFound', message: 'album not found' } });
      }
      res.status(500).json({ error: { code: 'InternalError', message: 'failed to update album' } });
    }
  });

  // Enable/disable
  router.post('/:id/toggle', (req, res) => {
    try {
      const { enabled } = req.body || {};
      if (enabled == null) {
        return res.status(400).json({ error: { code: 'ValidationError', message: 'enabled boolean required' } });
      }
      const result = albumRepo.toggle(req.params.id, !!enabled);
      res.json(result);
    } catch (e) {
      console.error('Toggle album failed:', e);
      res.status(500).json({ error: { code: 'InternalError', message: 'failed to toggle album' } });
    }
  });

  // Delete
  router.delete('/:id', (req, res) => {
    try {
      const row = albumRepo.get(req.params.id);
      if (!row) return res.status(404).json({ error: { code: 'NotFound', message: 'album not found' } });
      albumRepo.remove(req.params.id);
      res.status(204).end();
    } catch (e) {
      console.error('Delete album failed:', e);
      res.status(500).json({ error: { code: 'InternalError', message: 'failed to delete album' } });
    }
  });


  // Manual refresh
  router.post('/:id/refresh', ensureAuthed, async (req, res) => {
    try {
      const row = albumRepo.get(req.params.id);
      if (!row) {
        return res.status(404).json({ error: { code: 'NotFound', message: 'album not found' } });
      }

      // Normalize album query pieces from row
      const type    = inferType(row); // 'tag' | 'user' | 'compound'
      const tagsRaw = parseJsonArray(row.query_tags);      // e.g. ["italy","travel"]
      const users   = parseJsonArray(row.query_users);     // expected: resolved account IDs if that's how you store them
      const tagmode = String(row.query_tagmode || 'any').toLowerCase(); // 'any' | 'all'

      // Safety-normalize tags: strip '#', lowercase, unique
      const tags = Array.from(new Set(
        (Array.isArray(tagsRaw) ? tagsRaw : [])
          .map(s => String(s).replace(/^#/, '').trim().toLowerCase())
          .filter(Boolean)
      ));

      // Decide fetch size: use album limit if present; otherwise default & add headroom for filtering
      const baseLimit = Number(row.page_limit || row.limit || 24);
      const headroom  = Math.min(baseLimit * 3, 120);

      // Fetch candidates based on album type
      let candidates = [];
      if (type === 'tag') {
        // For tagmode='all', fetcher should locally AND-match tags
        candidates = await photoFetcher.getLatestPhotosForTags(tags, { limit: headroom, tagmode });
      } else if (type === 'user') {
        // If you store accts instead, resolve before calling
        candidates = await photoFetcher.getLatestPhotosForUsers(users, { limit: headroom });
      } else {
        // compound: fetch by users, then local tag filter (any/all)
        candidates = await photoFetcher.getLatestPhotosCompound(
          { tags, accountIds: users },
          { limit: headroom, tagmode }
        );
      }
      candidates = Array.isArray(candidates) ? candidates : [];

      // Upsert photos into DB → expect array of status_ids back
      const upsertedIdsRaw = photoRepo.upsertMany ? photoRepo.upsertMany(candidates) : [];
      const upsertedIds = Array.isArray(upsertedIdsRaw) ? upsertedIdsRaw : [];

      // Clean IDs (remove falsy + de-dup) before linking into album_items
      const cleanIds = Array.from(new Set(upsertedIds.filter(Boolean)));

      // Link into album_items (INSERT OR IGNORE handled in repo)
      const linkedCount = albumRepo.addPhotos(row.id, cleanIds);

      // Update album refresh timestamp (add watermarks later if you track them)
      albumRepo.update(row.id, { last_checked_at: new Date().toISOString() });

      return res.json({
        albumId: row.id,
        type,
        tagmode,
        requested: headroom,
        fetched: candidates.length,
        upserted: cleanIds.length,
        linked: linkedCount
      });
    } catch (e) {
      console.error('Refresh album failed:', e);
      return res.status(500).json({ error: { code: 'InternalError', message: 'failed to refresh album' } });
    }
  });

  // Get photos in an album
  router.get('/:id/photos', (req, res) => {
    try {
      const id = req.params.id;
      const offset = clamp(Number(req.query.offset ?? 0), 0, 10_000_000);
      const limit = clamp(Number(req.query.limit ?? 20), 1, 100);

      const albumRow = albumRepo.get(id);
      if (!albumRow) {
        return res.status(404).json({ error: { code: 'NotFound', message: 'album not found' } });
      }

      const result = photoRepo.listForAlbum(id, { offset, limit }) || {};
      const rows   = Array.isArray(result.items) ? result.items : [];
      const total  = Number.isFinite(result.total) ? result.total : rows.length;

      const items = rows.map(mapPhotoRow);
      return res.json({ items, total, offset, limit });
    } catch (e) {
      console.error('List album photos failed:', e);
      return res.status(500).json({ error: { code: 'InternalError', message: 'failed to list album photos' } });
    }
  });

  // Mount under /api/albums
  app.use('/api/albums', router);
}