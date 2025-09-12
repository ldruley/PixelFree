// albumRepo.js - Albums & AlbumItems repository
import db from './db.js';
import crypto from 'crypto';

function nowIso() { return new Date().toISOString(); }
function genId(prefix = 'alb') { return `${prefix}_${crypto.randomUUID()}`; }

export function create({ name, query, refresh, enabled = true, id }) {
  const created_at = nowIso();
  const updated_at = created_at;
  const albumId = id || genId();

  db.prepare(`INSERT INTO albums
    (id, name, created_at, updated_at, enabled, query_type, query_tags, query_users, query_tagmode, query_limit, refresh_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(albumId, name, created_at, updated_at, enabled ? 1 : 0,
         query.type,
         query.tags ? JSON.stringify(query.tags) : null,
         query.users ? JSON.stringify(query.users) : null,
         query.tagmode || 'any',
         query.limit ?? 20,
         JSON.stringify(refresh || {}));

  return get(albumId);
}

export function get(id) {
  return db.prepare('SELECT * FROM albums WHERE id = ?').get(id);
}

export function list({ offset = 0, limit = 50 } = {}) {
  const items = db.prepare('SELECT * FROM albums ORDER BY updated_at DESC LIMIT ? OFFSET ?')
                  .all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) as c FROM albums').get().c;
  return { items, total, offset, limit };
}

export function update(id, patch) {
  const current = get(id);
  if (!current) throw new Error('AlbumNotFound');
  const updated_at = nowIso();

  db.prepare(`UPDATE albums SET
    name=?, updated_at=?, enabled=?,
    query_type=?, query_tags=?, query_users=?,
    query_tagmode=?, query_limit=?, refresh_json=?
    WHERE id=?`)
    .run(
      patch.name ?? current.name,
      updated_at,
      patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : current.enabled,
      patch.query?.type ?? current.query_type,
      patch.query?.tags ? JSON.stringify(patch.query.tags) : current.query_tags,
      patch.query?.users ? JSON.stringify(patch.query.users) : current.query_users,
      patch.query?.tagmode ?? current.query_tagmode,
      patch.query?.limit ?? current.query_limit,
      JSON.stringify({ ...JSON.parse(current.refresh_json), ...(patch.refresh || {}) }),
      id
    );

  return get(id);
}

export function remove(id) {
  db.prepare('DELETE FROM albums WHERE id=?').run(id);
}

export function addPhotos(albumId, statusIds, { returnCount = true } = {}) {
  if (!Array.isArray(statusIds) || statusIds.length === 0) {
    return returnCount ? 0 : undefined;
  }

  const added_at = nowIso();
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO album_items (album_id, status_id, added_at) VALUES (?, ?, ?)'
  );

  const tx = db.transaction((ids) => {
    let inserted = 0;
    for (const sid of ids) {
      const info = stmt.run(albumId, sid, added_at);
      if (returnCount && info.changes > 0) inserted++;
    }
    return inserted;
  });

  const n = tx(statusIds);
  return returnCount ? n : undefined;
}

export function listItems(albumId, { offset = 0, limit = 20 } = {}) {
  const rows = db.prepare(`
    SELECT status_id FROM album_items
    WHERE album_id = ?
    ORDER BY added_at DESC
    LIMIT ? OFFSET ?`).all(albumId, limit, offset);

  const total = db.prepare('SELECT COUNT(*) as c FROM album_items WHERE album_id=?').get(albumId).c;
  return { items: rows.map(r => r.status_id), total, offset, limit };
}