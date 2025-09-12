// photoRepo.js - Photos repository
import db from './db.js';

export function upsertMany(photos) {
  const rows = Array.isArray(photos) ? photos : [];
  if (rows.length === 0) return [];

  const stmt = db.prepare(`
    INSERT INTO photos
      (status_id, created_at, author_id, author_acct, author_username, author_display, author_avatar,
       caption_html, post_url, tags_json, url, preview_url, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(status_id) DO UPDATE SET
      created_at     = excluded.created_at,
      author_id      = excluded.author_id,
      author_acct    = excluded.author_acct,
      author_username= excluded.author_username,
      author_display = excluded.author_display,
      author_avatar  = excluded.author_avatar,
      caption_html   = excluded.caption_html,
      post_url       = excluded.post_url,
      tags_json      = excluded.tags_json,
      url            = excluded.url,
      preview_url    = excluded.preview_url,
      fetched_at     = excluded.fetched_at
  `);

  const tx = db.transaction((items) => {
    const ids = [];
    const nowIso = new Date().toISOString();

    for (const p of items) {
      // derive a stable primary key
      const sid = p?.status_id ?? p?.id;
      if (!sid) continue; // skip malformed rows

      // normalize tags array → JSON string (lowercased & de-duplicated)
      let tagsJson = null;
      if (Array.isArray(p?.tags)) {
        const tags = Array.from(
          new Set(
            p.tags
             .map(t => String(t).replace(/^#/, '').trim().toLowerCase())
             .filter(Boolean)
          )
        );
        tagsJson = tags.length ? JSON.stringify(tags) : null;
      }

      stmt.run(
        sid,
        p?.created_at ?? null,
        p?.author?.id ?? null,
        p?.author?.acct ?? null,
        p?.author?.username ?? null,
        p?.author_display_name ?? p?.author?.display_name ?? null,
        p?.author?.avatar ?? null,
        p?.caption ?? p?.content ?? null,
        p?.post_url ?? p?.status_url ?? null,
        tagsJson,
        p?.url ?? null,
        p?.preview_url ?? p?.url ?? null,
        nowIso
      );

      ids.push(sid);
    }
    return ids;
  });

  return tx(rows);
}

export function getMany(statusIds) {
  if (!statusIds?.length) return [];
  const placeholders = statusIds.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM photos WHERE status_id IN (${placeholders})`)
           .all(...statusIds);
}

export function listForAlbum(albumId, { offset = 0, limit = 20 } = {}) {
  const rows = db.prepare(`
    SELECT p.* FROM album_items ai
    JOIN photos p ON p.status_id = ai.status_id
    WHERE ai.album_id = ?
    ORDER BY ai.added_at DESC
    LIMIT ? OFFSET ?`).all(albumId, limit, offset);

  const total = db.prepare('SELECT COUNT(*) as c FROM album_items WHERE album_id=?').get(albumId).c;
  return { items: rows, total, offset, limit };
}

export function removeUnreferenced() {
  return db.prepare(`DELETE FROM photos WHERE status_id IN (
    SELECT p.status_id FROM photos p
    LEFT JOIN album_items ai ON ai.status_id = p.status_id
    WHERE ai.status_id IS NULL
  )`).run().changes;
}