/**
 * modules/photoService.js
 * -----------------------
 * High-level service for fetching and normalizing photos from a Pixelfed instance.
 *
 * This module provides a single entry point, `fetchPhotos(opts)`, that queries
 * different Pixelfed timelines (tag, user, or public) and returns a uniform list
 * of photo objects. It abstracts away endpoint details, authentication, and
 * response normalization so that the rest of the backend can work with a clean
 * photo model.
 *
 * Responsibilities
 * - Build the correct Pixelfed API endpoint depending on the source type:
 *   - `tag`   → /api/v1/timelines/tag/:tag
 *   - `user`  → /api/v1/accounts/:id/statuses
 *   - `public`→ /api/v1/timelines/public (with optional `local=true`)
 * - Enforce limits (1–40) and fetch slightly more than requested, since not all
 *   statuses include images.
 * - Authenticate requests with a bearer token obtained from `auth.js`.
 * - Normalize posts into plain JS objects with consistent fields:
 *   `{ id, url, preview_url, created_at, author, author_display_name,
 *      caption, post_url, location, tags }`.
 * - Filter out non-image attachments.
 * - Sort results newest-first and return only the requested number of photos.
 *
 * Exports
 * - `async function fetchPhotos(opts: FetchArgs): Promise<Photo[]>`
 *     - `opts.limit`  → number of photos to return (1–40)
 *     - `opts.source` → one of:
 *         { type:'tag', tag:string }
 *         { type:'user', accountId:string }
 *         { type:'public', localOnly?:boolean }
 *
 * Notes
 * - Returns caption as raw HTML from Pixelfed (callers must sanitize if needed).
 * - Uses `process.env.PIXELFED_INSTANCE` for the base instance URL.
 * - This module does not handle caching; consumers may store results if needed.
 */

import { getAccessToken } from './auth.js';

/**
 * @typedef {{ type:'tag', tag:string } | { type:'user', accountId:string } | { type:'public', localOnly?:boolean }} Source
 * @typedef {{ limit:number, source: Source }} FetchArgs
 */

/** @param {FetchArgs} opts */
export async function fetchPhotos(opts) {
  const instanceUrl = process.env.PIXELFED_INSTANCE || 'https://pixelfed.social';
  const token = await getAccessToken();

  const limit = Math.max(1, Math.min(40, Number(opts.limit) || 10));
  const src = opts.source;

  let endpoint;
  if (src.type === 'tag') {
    endpoint = new URL(`/api/v1/timelines/tag/${encodeURIComponent(src.tag)}`, instanceUrl);
    endpoint.searchParams.set('limit', String(limit * 2)); // grab a bit more; we’ll filter images only
  } else if (src.type === 'user') {
    endpoint = new URL(`/api/v1/accounts/${encodeURIComponent(src.accountId)}/statuses`, instanceUrl);
    endpoint.searchParams.set('limit', String(limit * 2));
  } else if (src.type === 'public') {
    endpoint = new URL(`/api/v1/timelines/public`, instanceUrl);
    endpoint.searchParams.set('limit', String(limit * 2));
    if (src.localOnly) endpoint.searchParams.set('local', 'true');
  } else {
    throw new Error('Unsupported source');
  }

  const res = await fetch(endpoint, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  const payload = await res.json().catch(() => []);
  if (!res.ok) {
    throw new Error(`Pixelfed fetch failed (${res.status}) ${JSON.stringify(payload)}`);
  }

  // Normalize: images only → newest-first → slice to limit
  const photos = [];
  for (const s of payload) {
    const atts = Array.isArray(s.media_attachments) ? s.media_attachments : [];
    for (const m of atts) {
      if (m.type === 'image' && m.url) {
        photos.push({
          id: m.id || s.id,
          url: m.url,
          preview_url: m.preview_url || m.url,
          created_at: s.created_at,
          author: s.account ? {
            id: s.account.id,
            username: s.account.acct || s.account.username,
            url: s.account.url
          } : undefined,
          author_display_name: s.account?.display_name,
          caption: s.content,          // HTML
          post_url: s.url,
          location: s.location || s.place || s.geo, // if available
          tags: Array.isArray(s.tags) ? s.tags.map(t => t.name) : []
        });
      }
    }
  }

  photos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return photos.slice(0, limit);
}
