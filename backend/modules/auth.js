/**
 * modules/auth.js
 * ----------------
 * Backend authentication helper for Pixelfed OAuth2.
 *
 * This module manages the entire OAuth2 login lifecycle with a Pixelfed instance:
 *   - Generating the authorization URL for the user to log in
 *   - Handling the callback and exchanging an authorization code for access/refresh tokens
 *   - Persisting tokens securely to disk (`.token.json`)
 *   - Reporting authentication status and token expiry
 *   - Refreshing tokens when near or past expiration
 *   - Logging out (removing stored tokens)
 *
 * Responsibilities
 * - Encapsulate all OAuth2 protocol details so that other backend services can
 *   simply call `getAccessToken()` when they need a valid token.
 * - Ensure tokens are refreshed automatically when expired or nearly expired.
 * - Maintain minimal, file-based session state between application runs.
 *
 * Exports
 * - `getLoginUrl()`        → Return the Pixelfed OAuth2 authorization URL.
 * - `handleCallback(query)`→ Exchange an OAuth2 `code` for tokens and persist them.
 * - `getStatus()`          → Report whether the user is currently authenticated.
 * - `logout()`             → Clear the stored tokens, ending the session.
 * - `getAccessToken()`     → Return a valid access token, refreshing if needed.
 *
 * Notes
 * - Tokens are stored in `.token.json` at the project root with file permissions
 *   restricted to the current user (mode 600).
 * - This module is strictly **backend only**; frontend code should not import it.
 * - Reads configuration (instance URL, client ID/secret, redirect URI) from
 *   environment variables set in `.env`.
 */

import fs from 'fs';
import path from 'path';

const TOKEN_PATH = path.resolve('.token.json');

function cfg() {
  return {
    instanceUrl: process.env.PIXELFED_INSTANCE || 'https://pixelfed.social',
    clientId: process.env.PIXELFED_CLIENT_ID,
    clientSecret: process.env.PIXELFED_CLIENT_SECRET,
    redirectUri: process.env.PIXELFED_REDIRECT_URI || 'http://localhost:3000/api/callback',
    scope: 'read'
  };
}

function readToken() {
  try { return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')); }
  catch { return null; }
}

function writeToken(tokens) {
  if (!tokens.created_at) tokens.created_at = Math.floor(Date.now() / 1000);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export function getLoginUrl() {
  const { instanceUrl, clientId, redirectUri, scope } = cfg();
  const u = new URL('/oauth/authorize', instanceUrl);
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', scope); // pixelfed.social expects "read"
  return u.toString();
}

export async function handleCallback(query) {
  const { code } = query || {};
  if (!code) throw new Error('Missing code');

  const { instanceUrl, clientId, clientSecret, redirectUri } = cfg();

  const res = await fetch(new URL('/oauth/token', instanceUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: String(code)
    })
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${JSON.stringify(body)}`);
  }

  writeToken(body);
  return { ok: true };
}

export function getStatus() {
  const t = readToken();
  if (!t) return { authenticated: false };
  const expiresAt = t.created_at + t.expires_in;
  return { isAuthenticated: true, expiresAt };
}

export function logout() {
  try { fs.unlinkSync(TOKEN_PATH); } catch {}
}

export async function getAccessToken() {
  const t = readToken();
  if (!t) throw new Error('Not authenticated');

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = t.created_at + t.expires_in;
  if (now < (expiresAt - 60)) return t.access_token; // still valid

  // Refresh
  const { instanceUrl, clientId, clientSecret } = cfg();
  const res = await fetch(new URL('/oauth/token', instanceUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: t.refresh_token,
      scope: 'read'
    })
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    try { fs.unlinkSync(TOKEN_PATH); } catch {}
    throw new Error(`Refresh failed (${res.status}): ${JSON.stringify(body)}`);
  }

  body.created_at = Math.floor(Date.now() / 1000);
  writeToken(body);
  return body.access_token;
}
