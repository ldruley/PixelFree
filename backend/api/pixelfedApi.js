/**
 * pixelfedApi.js
 * ----------------
 * HTTP helper for calling a Pixelfed instance.
 *
 * This module exposes a single function, `get(path, options)`, which builds and
 * executes a GET request against the configured Pixelfed base URL, then returns
 * the parsed JSON response. It centralizes URL construction, query-parameter
 * handling, headers (including optional auth), and consistent error handling.
 *
 * Responsibilities
 * - Join the configured base instance URL (from environment) with a relative `path`
 * - Append query parameters (if provided) to the request URL
 * - Set request headers (e.g., `Authorization: Bearer <token>` when supplied)
 * - Perform the network call and parse JSON results
 * - Throw informative errors on non-2xx responses so callers can map them to API responses
 *
 * Exports
 * - `async function get(path, { params, headers, token, ...other } = {})`
 *    - `path`    : string   — relative Pixelfed API path (e.g., `/api/v1/timelines/tag/<tag>`)
 *    - `params`  : object   — key/value pairs serialized onto the query string
 *    - `headers` : object   — additional headers to merge into the request
 *    - `token`   : string   — optional OAuth access token; when present, adds `Authorization` header
 *    - `other`   : object   — any extra fetch/retry options this module supports
 *
 * Usage example:
 *   import { get } from '../api/pixelfedApi.js';
 *
 *   const data = await get(
 *     `/api/v1/timelines/tag/${encodeURIComponent(tag)}`,
 *     { params: { limit: 20 }, token: accessToken }
 *   );
 *
 * Notes
 * - OAuth login and token refresh are handled elsewhere; pass a valid `token` if needed.
 * - The Pixelfed base URL is read from environment (e.g., `PIXELFED_INSTANCE`).
 */

import { withRetry } from '../utils/http.js';

/**
 * @template T
 * @param {string} path
 * @param {string} accessToken
 * @param {Record<string, string | number | boolean>} [params]
 * @returns {Promise<{ status:number, data:T }>}
 */
export async function get(path, accessToken, params = {}) {
  const base = process.env.PIXELFED_INSTANCE || 'https://pixelfed.social';
  const u = new URL(path, base);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      u.searchParams.set(k, String(v));
    }
  }

  const doFetch = async () => {
    const res = await fetch(u, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    const status = res.status;
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const err = new Error(`Pixelfed GET ${u.pathname} failed (${status})`);
      err.status = status;
      err.data = data;
      throw err;
    }
    return { status, data };
  };

  return withRetry(doFetch, { retries: 3, baseDelayMs: 400 });
}
