# PixelFree – Caching and Update Strategy

## Goals
- Minimize API & media traffic to remote instances.
- Keep “virtual albums” fresh enough to feel live.
- Work reliably even with partial federation and intermittent connectivity.
- Be simple to reason about and test.

## Architecture: Two-layer cache
1. **Metadata cache** (SQLite):
   - Keyed by **status_id**.
   - Fields: 	`status_id, author_id, acct, created_at, tags[], media_urls[], preview_url, caption, post_url, album_ids[], fetched_at`
   - Indexes on `created_at`, `tags`, `author_id`.
2. **Media cache** (filesystem):
   - Store images under a hashed path: `cache/media/ab/cd/<status_id>-<n>.jpg`.
   - Keep a **manifest**: `status_id -> [local_file_paths]`, `content_length`, `fetched_at`.
   - Enforce **size quota** (e.g., 1–2 GB) with **LRU** eviction and **TTL** (e.g., 30–90 days).
   - Respect `Cache-Control` max-age if present on CDN responses; otherwise use a conservative TTL.

## Album model & refresh state
Each saved “virtual album” (your query) maintains:

- `type`: `tag` | `user` | `compound`
- `tags[]` (normalized, no `#`)
- `tagmode`: `all` | `any` (controls whether all tags must match or any may match; applies to `type: tag` and the tag portion of `type: compound`)
- `user_ids[]` or `accts[]` (resolved to IDs)
- **Refresh policy**: `intervalMs` (user-set), `last_checked_at`, `backoff_until` (when rate-limited)
- **Pagination watermarks**:
  - `since_id` (newer-than for next poll)
  - `max_id` (older-than for backfill)
- **Local result set**: list of `status_id` sorted by `created_at` (bounded to album limit * some headroom)

UI can expose: **Refresh every**: _5 min / 15 min / hourly_, plus **Manual refresh**.  
Also expose **Match mode**: _All tags must match_ / _Any tag may match_.

## Fetch strategies by album type
- **Tag (`tagmode = any`)**: poll `/timelines/tag/:tag` separately for each tag, then union the results.
- **Tag (`tagmode = all`)**:  
  - Preferred: fetch each tag timeline, intersect results locally (more reliable across federation).  
  - Alternate: use server-side multiple-tag queries if supported by the instance (less common).
- **User OR**: poll `/accounts/:id/statuses` with `since_id`.
- **Tags+Users AND**:
  - Fetch user posts (`/accounts/:id/statuses`).
  - Filter locally by tags.
  - If `tagmode = all`, require all specified tags to be present; if `any`, require at least one.

Keep a larger headroom (e.g., request 3× the album limit) so filtering has enough candidates, especially for `tagmode = all`.

## Polling & backoff
- **Scheduler** runs every minute, but **only touches albums whose `intervalMs` has elapsed**.
- Apply **jitter** ±20% to each album’s interval to avoid thundering herd.
- On **429** (rate limit): read `Retry-After` if present → set `backoff_until`, skip until then; also increase interval temporarily (exponential backoff with cap).
- On **5xx / network error**: try again next cycle; show a gentle inline notice in the UI.

## Freshness & since_id flow (pseudocode)
```js
async function refreshAlbum(album) {
  if (Date.now() < album.backoff_until) return;

  const headroom = Math.min(album.limit * 3, 120);
  const params = { since_id: album.since_id, limit: headroom };
  let posts = [];

  if (album.type === 'tag') {
    if (album.tagmode === 'any') {
      posts = await unionTagTimelines(album.tags, params);
    } else { // tagmode === 'all'
      posts = await intersectTagTimelines(album.tags, params);
    }
  } else if (album.type === 'user') {
    posts = await fetchUsersStatuses(album.user_ids, params);
  } else { // compound: users + tags
    const candidates = await fetchUsersStatuses(album.user_ids, params);
    posts = filterByTags(candidates, album.tags, album.tagmode);
  }

  const newIds = upsertPosts(posts);
  const newest = maxId(newIds, album.since_id);
  if (newest) album.since_id = newest;

  album.status_ids = mergeAndTrim(album.status_ids, newIds, album.limit * 5);
  album.last_checked_at = Date.now();
}
```

## Serving images efficiently
- **First render:** use **preview_url** (smaller) to minimize bandwidth; load full `url` on demand or when shown.
- **Preload next N** items in background (N=2–4).
- Media requests:
  - Send `If-None-Match` / `If-Modified-Since` if the CDN exposes ETag/Last-Modified.
  - On 304, just bump `fetched_at`.
- **Offline mode:** Front end shows cached images only; scheduler queues refresh attempts but doesn’t hard-fail the UI.

## Eviction policy
- Target disk quota: e.g., 1 GB (configurable).
- When exceeding quota or TTL:
  1. Evict media not referenced by any **active album**.
  2. Then evict by **LRU** across the remainder.
- Keep metadata longer than media; it’s cheap and speeds up “seen” checks.

## Respectful defaults (per album, overridable)
- Tag albums: **every 10–15 min** (with jitter)
- User albums: **every 5–10 min**
- AND albums: **every 10–15 min**
- Manual **“Refresh now”** button always available.
- Global **“Pause updates”** toggle.

## API & UI tie-ins
- Backend:
  - `GET /api/albums/:id` → album config + last refresh + counts.
  - `POST /api/albums/:id/refresh` → manual refresh endpoint.
  - `GET /api/photos/query` → add `X-Cache: HIT|MISS` header (optional).
- Frontend:
  - Settings screen: slider/select for **Refresh interval**.
  - Toggle or dropdown for **Tag matching mode** (All / Any).
  - Notices for **rate limited** and **upstream down**.

## Security & privacy
- Purge cache on **logout**.
- Separate per-account cache namespaces for multi-user devices.
- Don’t log media URLs in verbose logs.

## Stretch ideas
- **Heuristic freshness:** auto-extend refresh interval if no new content for a while.
- **Content dedupe:** store one copy of media used in multiple posts.
