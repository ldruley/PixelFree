/**
 * modules/accounts.js
 * -------------------
 * Resolve Fediverse/Pixelfed account identifiers (“acct” strings) to numeric
 * account IDs, with input normalization, robust error typing, and a small
 * in-memory cache.
 *
 * Purpose
 *   Accepts a variety of user inputs (e.g., "name", "@name", "name@host",
 *   "@name@host", or full profile URLs like "https://host/@name") and resolves
 *   them to a Pixelfed/Mastodon account ID by querying the configured instance.
 *
 * Error model (typed)
 *   - ValidationError  → malformed/empty acct input (e.g., bad domain)
 *   - NotFoundError    → no matching account after all strategies
 *   - RateLimitError   → HTTP 429 from upstream (includes optional retryAfter)
 *   - UpstreamError    → network failures or 5xx responses from upstream
 *
 * Caching
 *   Maintains a simple Map (normalized acct → accountId) to avoid repeated
 *   resolutions within the process lifetime.
 *
 * Configuration & auth
 *   - Base instance URL comes from `process.env.PIXELFED_INSTANCE` (defaults to https://pixelfed.social).
 *   - Uses `getAccessToken()` to attach a Bearer token when calling the remote API.
 *
 * Exports
 *   - async function resolveAccountId(acct: string): Promise<string>
 *       Normalize & validate input; resolve to a single account ID or throw a typed error.
 *   - async function resolveManyAccts(accts: Iterable<string>): Promise<string[]>
 *       Deduplicate, normalize, resolve each (with caching), return unique IDs.
 *
 * Notes
 *   - JSON parsing is tolerant; 4xx responses that aren’t thrown by design fall through to the next strategy.
 */

import { getAccessToken } from './auth.js';
import {
  ValidationError,
  NotFoundError,
  UpstreamError,
  RateLimitError,
} from './errors.js';

function baseUrl() {
  return process.env.PIXELFED_INSTANCE || 'https://pixelfed.social';
}

function normalizeAcct(acct) {
  let s = String(acct || '').trim().replace(/^@/, '');

  if (!s) {
    throw new ValidationError('Missing account', { acct });
  }

  // Allow profile URLs like https://mastodon.sdf.org/@icm → icm@mastodon.sdf.org
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      const m = u.pathname.match(/\/@([^/]+)/);
      if (m) s = `${m[1]}@${u.hostname}`;
    }
  } catch {
    // ignore URL parse issues; treat as raw input below
  }

  // If remote, ensure domain looks valid
  if (s.includes('@')) {
    const [, host] = s.split('@');
    if (!host || !host.includes('.')) {
      throw new ValidationError(
        'Invalid account format. Expected user@host',
        { acct }
      );
    }
  }

  return s;
}

function headersWith(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
}

async function safeFetchJson(u, headers, contextMeta) {
  let res;
  try {
    res = await fetch(u, { headers });
  } catch (e) {
    // Network/DNS/TLS failure
    throw new UpstreamError('Unable to reach the remote instance', {
      ...contextMeta,
      cause: String(e),
    });
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after')) || undefined;
    throw new RateLimitError('Rate limited by the remote instance', {
      ...contextMeta,
      retryAfter,
    });
  }
  if (res.status >= 500) {
    throw new UpstreamError('Remote instance error', {
      ...contextMeta,
      status: res.status,
    });
  }

  // Parse JSON for ok/4xx paths. If JSON fails, treat as not found/empty later.
  let data = null;
  try {
    data = await res.json();
  } catch {
    // leave data as null; caller will decide if that means "not found"
  }
  return { ok: res.ok, status: res.status, data };
}

/**
 * Resolve a user handle (acct) to an account ID.
 * Accepts "name", "@name", "name@domain", "@name@domain", and common profile URLs.
 * Tries v2 search (resolve=true), then v1 lookup (local), then v1 accounts/search (local).
 * Throws typed errors:
 *  - ValidationError (bad format)
 *  - NotFoundError   (cannot resolve)
 *  - UpstreamError   (remote 5xx / network failures)
 *  - RateLimitError  (429)
 */
export async function resolveAccountId(acct) {
  const clean = normalizeAcct(acct);
  const token = await getAccessToken();
  const base = baseUrl();
  const headers = headersWith(token);
  const meta = { acct: clean };

  // 1) v2 search with resolve=true (works for remote handles)
  {
    const u = new URL('/api/v2/search', base);
    u.searchParams.set('q', clean);
    u.searchParams.set('resolve', 'true');
    u.searchParams.set('type', 'accounts');
    u.searchParams.set('limit', '1');

    const { ok, data } = await safeFetchJson(u, headers, meta);
    if (ok && data?.accounts?.length && data.accounts[0]?.id) {
      return data.accounts[0].id;
    }
    // If not ok but not thrown (e.g., 404/400), just fall through to next strategy
  }

  // 2) If it looks local (no domain part), try v1 lookup (fast local path)
  if (!clean.includes('@')) {
    const u = new URL('/api/v1/accounts/lookup', base);
    u.searchParams.set('acct', clean);
    const { ok, data } = await safeFetchJson(u, headers, meta);
    if (ok && data?.id) return data.id;
  }

  // 3) Fallback: v1 accounts/search (local search)
  {
    const u = new URL('/api/v1/accounts/search', base);
    u.searchParams.set('q', clean);
    u.searchParams.set('limit', '1');
    const { ok, data } = await safeFetchJson(u, headers, meta);
    if (ok && Array.isArray(data) && data[0]?.id) {
      return data[0].id;
    }
  }

  // All strategies failed without a typed error already thrown → NotFound
  throw new NotFoundError('Account not found on the remote instance', { acct: clean });
}

const _acctCache = new Map(); // normalized acct -> accountId

export async function resolveManyAccts(accts) {
  const inputs = Array.from(
    new Set((accts || []).map(a => String(a || '').trim()).filter(Boolean))
  );

  const resolved = [];
  for (const raw of inputs) {
    const key = normalizeAcct(raw); // normalize early for consistent caching and validation
    if (_acctCache.has(key)) {
      resolved.push(_acctCache.get(key));
      continue;
    }
    const id = await resolveAccountId(key); // will throw typed errors on failure
    if (id) {
      _acctCache.set(key, id);
      resolved.push(id);
    }
  }
  return Array.from(new Set(resolved));
}