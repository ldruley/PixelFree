-- PixelFree SQLite schema (v1)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS albums (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  enabled       INTEGER NOT NULL DEFAULT 1,

  -- Album query
  query_type    TEXT NOT NULL CHECK (query_type IN ('tag','user','compound')),
  query_tags    TEXT,                         -- JSON array of tags
  query_users   TEXT,                         -- JSON (accts[] or ids[])
  query_tagmode TEXT NOT NULL DEFAULT 'any'   CHECK (query_tagmode IN ('any','all')),
  query_limit   INTEGER NOT NULL DEFAULT 20,

  -- Refresh policy
  refresh_json  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS photos (
  status_id         TEXT PRIMARY KEY,
  created_at        TEXT NOT NULL,
  author_id         TEXT,
  author_acct       TEXT,
  author_username   TEXT,
  author_display    TEXT,
  author_avatar     TEXT,
  caption_html      TEXT,
  post_url          TEXT,
  tags_json         TEXT,
  url               TEXT,
  preview_url       TEXT,
  fetched_at        TEXT,
  etag              TEXT,
  last_verified_at  TEXT
);

CREATE TABLE IF NOT EXISTS album_items (
  album_id    TEXT NOT NULL,
  status_id   TEXT NOT NULL,
  added_at    TEXT NOT NULL,
  PRIMARY KEY (album_id, status_id),
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
  FOREIGN KEY (status_id) REFERENCES photos(status_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS media_manifest (
  status_id         TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('preview','original')),
  path              TEXT NOT NULL,
  content_length    INTEGER,
  fetched_at        TEXT,
  last_accessed_at  TEXT,
  PRIMARY KEY (status_id, kind),
  FOREIGN KEY (status_id) REFERENCES photos(status_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kv (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);