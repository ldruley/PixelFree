/**
 * modules/photoFetcher.js
 * -----------------------
 * High-level backend service for retrieving photo posts from a Pixelfed instance.
 *
 * This module implements the main query logic for PixelFree’s virtual albums.
 * It supports fetching photos by:
 *   - One or more hashtags (tag timelines, with “any” or “all” tag match modes)
 *   - One or more user accounts (statuses from specific accounts)
 *   - Combined tags + users (AND semantics: fetch user posts, then filter locally by tags)
 *
 * Key responsibilities:
 * - Wrap Pixelfed/Mastodon API calls for tag timelines and user statuses.
 * - Apply local filtering for tag requirements, since federated servers cannot
 *   reliably filter remote posts by tag.
 * - Normalize raw statuses into a consistent `Photo` object shape:
 *     `{ id, created_at, author, author_display_name, caption, post_url,
 *        tags[], url, preview_url }`
 * - Support OR vs ALL tag logic (`tagmode` option).
 * - Deduplicate posts and enforce configurable limits (1–40).
 * - Handle transient errors and rate limits with meaningful error types.
 *
 * Exports:
 * - `getLatestPhotosForTags(tags: string[], opts)`  
 *     Fetch recent posts for given tags, with “any” or “all” tag logic.
 * - `getLatestPhotosForUsers(accountIds: string[], opts)`  
 *     Fetch recent posts from one or more accounts.
 * - `getLatestPhotosCompound(input: { tags, accountIds }, opts)`  
 *     Fetch posts matching both tags and users (AND semantics, local filtering).
 *
 * Notes:
 * - Uses `auth.getAccessToken()` for OAuth2 bearer tokens.
 * - Base Pixelfed instance URL comes from `PIXELFED_INSTANCE` env var
 *   (defaults to https://pixelfed.social).
 * - Returns only image attachments; other media types are skipped.
 * - Sorting is newest-first by `created_at`.
 */

import { get as apiGet } from '../api/pixelfedApi.js';
import { getAccessToken } from '../modules/auth.js';
import { UpstreamError, RateLimitError } from '../modules/errors.js';

// Tag matching helpers (case-insensitive)
const norm = t => String(t || '').toLowerCase();

const hasAllTags = (postTags = [], required = []) => {
  if (!required.length) return true;
  const set = new Set(postTags.map(norm));
  return required.every(t => set.has(norm(t)));
};

const hasAnyTag = (postTags = [], required = []) => {
  if (!required.length) return true;
  const set = new Set(postTags.map(norm));
  return required.some(t => set.has(norm(t)));
};

/**
 * @typedef {{ limit:number }} FetchOptions
 */

function baseUrl() {
  return process.env.PIXELFED_INSTANCE || 'https://pixelfed.social';
}

// Minimal normalizer from Mastodon/Pixelfed statuses -> your photo shape
function normalizeStatusesToPhotos(statuses = []) {
  const out = [];
  for (const st of statuses) {
    const author = st.account || st.author || {};
    const tags = (st.tags || []).map(t => (typeof t === 'string' ? t : t?.name)).filter(Boolean);
    for (const m of (st.media_attachments || [])) {
      // Only images
      if (m.type && m.type !== 'image') continue;
      out.push({
        id: st.id,
        created_at: st.created_at,
        author: {
          id: author.id,
          acct: author.acct,
          username: author.username,
          display_name: author.display_name,
          avatar: author.avatar,
        },
        author_display_name: author.display_name || author.username,
        caption: st.content || st.caption || '',
        post_url: st.url || st.uri,
        tags,
        url: m.url || m.remote_url || m.preview_url,
        preview_url: m.preview_url || m.url,
      });
    }
  }
  return out;
}

/**
 * Fetch a single tag timeline from the configured instance.
 * Supports { limit, since_id, max_id }.
 * Returns an array of normalized photo objects (one entry per media attachment).
 */
async function fetchTagTimeline(tag, { limit = 20, since_id, max_id } = {}) {
  const base = baseUrl();
  const u = new URL(`/api/v1/timelines/tag/${encodeURIComponent(String(tag).replace(/^#/, ''))}`, base);
  u.searchParams.set('limit', String(limit));
  if (since_id) u.searchParams.set('since_id', String(since_id));
  if (max_id) u.searchParams.set('max_id', String(max_id));

  const token = await getAccessToken();
  let res;
  try {
    res = await fetch(u, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
  } catch (e) {
    throw new UpstreamError('Unable to reach the remote instance', { tag, cause: String(e) });
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after')) || undefined;
    throw new RateLimitError('Rate limited by the remote instance', { tag, retryAfter });
  }
  if (res.status >= 500) {
    throw new UpstreamError('Remote instance error', { tag, status: res.status });
  }
  if (!res.ok) {
    // 4xx other than 429 → treat as empty
    return [];
  }

  const data = await res.json();
  // If you already have a normalizer, use that here instead:
  // return normalizeStatusToPhotoList(data);
  return normalizeStatusesToPhotos(Array.isArray(data) ? data : []);
}

function statusToPhotos(status) {
  if (!status || !Array.isArray(status.media_attachments)) return [];
  const base = {
    id: status.id,
    created_at: status.created_at,
    author: status.account ? {
      id: status.account.id,
      acct: status.account.acct,
      username: status.account.username,
      display_name: status.account.display_name,
      avatar: status.account.avatar
    } : undefined,
    author_display_name: status.account?.display_name,
    caption: status.content,
    post_url: status.url,
    location: status.location || status.place || status.geo || undefined,
    tags: Array.isArray(status.tags) ? status.tags.map(t => t.name) : []
  };
  const out = [];
  for (const m of status.media_attachments) {
    if (m?.type === 'image' && m.url) {
      out.push({
        ...base,
        url: m.url,
        preview_url: m.preview_url || m.url
      });
    }
  }
  return out;
}

function dedupeById(list) {
  const seen = new Set();
  const out = [];
  for (const p of list) {
    if (!seen.has(p.id)) { seen.add(p.id); out.push(p); }
  }
  return out;
}

function intersectById(a, b) {
  const ids = new Set(b.map(p => p.id));
  return a.filter(p => ids.has(p.id));
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

export async function getLatestPhotosForTags(tagsInput, opts = {}) {
  const limit = clamp(Number(opts.limit) || 20, 1, 40);
  const tagmode = String(opts.tagmode || 'any').toLowerCase(); // 'any' | 'all'
  const tags = (tagsInput || [])
    .map(s => String(s).replace(/^#/, '').trim())
    .filter(Boolean);

  if (!tags.length) return [];

  // Fetch per-tag timelines in parallel
  const headroom = Math.min(limit * 5, 200); // extra for intersection/filter
  const perTagLists = await Promise.all(
    tags.map(t => fetchTagTimeline(t, { limit: headroom }))
  );

  // Union candidates by status id (so duplicates collapse)
  const candidates = [...new Map(
    perTagLists.flat().map(p => [p.id, p])
  ).values()];

  const filtered = candidates.filter(p =>
    tagmode === 'all'
      ? hasAllTags(p.tags, tags)
      : hasAnyTag(p.tags, tags)
  );

  // Newest first, cap to limit
  filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return filtered.slice(0, limit);
}

export async function getLatestPhotosForUsers(accountIds, opts) {
  const token = await getAccessToken();
  const limit = clamp(Number(opts?.limit)||20, 1, 40);
  const per = clamp(Math.ceil(limit * 1.5), 10, 40);

  const all = [];
  for (const id of accountIds) {
    const { data } = await apiGet(`/api/v1/accounts/${encodeURIComponent(id)}/statuses`, token, {
      limit: per, exclude_replies: true
    });
    if (Array.isArray(data)) {
      for (const st of data) all.push(...statusToPhotos(st));
    }
  }
  all.sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
  return dedupeById(all).slice(0, limit);
}

export async function getLatestPhotosCompound(input, opts = {}) {
  const limit = clamp(Number(opts.limit) || 20, 1, 40);
  const tagmode = String(opts.tagmode || 'any').toLowerCase(); // 'any' | 'all'
  const tags = (input.tags || [])
    .map(s => String(s).replace(/^#/, '').trim())
    .filter(Boolean);
  const users = (input.accountIds || []).filter(Boolean);

  if (tags.length && !users.length) {
    return getLatestPhotosForTags(tags, { limit, tagmode });
  }
  if (users.length && !tags.length) {
    return getLatestPhotosForUsers(users, { limit });
  }

  // AND semantics in federated context:
  // Fetch user posts, then filter locally by tags (ANY or ALL).
  const headroom = Math.min(limit * 3, 120);
  const userPosts = await getLatestPhotosForUsers(users, { limit: headroom });

  const filtered = userPosts.filter(p =>
    tagmode === 'all'
      ? hasAllTags(p.tags, tags)
      : hasAnyTag(p.tags, tags)
  );

  filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return filtered.slice(0, limit);
}