/**
 * modules/settings.js
 * -------------------
 * Centralized configuration state for the PixelFree backend.
 *
 * This module holds runtime settings (instance credentials, display options,
 * data source, sync/cache parameters) in a single object. It exposes helpers
 * to read or update these values across the application.
 *
 * Responsibilities
 * - Provide default values for:
 *   - Pixelfed instance connection (instance URL, client ID/secret, redirect URI)
 *   - Display behavior (e.g., transition timing, captions on/off)
 *   - Content source defaults (e.g., type 'tag', default tag)
 *   - Sync/caching settings (fetch interval, fetch limit, cache budget in bytes)
 * - Expose a getter for other modules to read current settings
 * - Allow controlled updates of settings at runtime via shallow merge
 *
 * Exports
 * - `getSettings()` → return the current settings object
 * - `updateSettings(partial: object)` → merge updates into the settings object and return the new state
 *
 * Notes
 * - Settings are initialized from environment variables (`PIXELFED_INSTANCE`,
 *   `PIXELFED_CLIENT_ID`, etc.) with sensible defaults if not provided.
 * - In-memory only: updates are not persisted to disk or database between runs.
 * - Intended as a lightweight runtime config store for development/testbed use.
 */


let settings = {
  instanceUrl: process.env.PIXELFED_INSTANCE || 'https://pixelfed.social',
  clientId: process.env.PIXELFED_CLIENT_ID || 'FAKE_ID',
  clientSecret: process.env.PIXELFED_CLIENT_SECRET || 'FAKE_SECRET',
  redirectUri: process.env.PIXELFED_REDIRECT_URI || 'http://localhost:3000/api/callback',
  display: { transitionMs: 5000, showCaptions: true },
  source: { type: 'tag', tag: 'vacation' },
  sync: { intervalMs: 300000, fetchLimit: 20, cacheBudgetBytes: 500 * 1024 * 1024 }
};

export function getSettings() {
  return settings;
}

export function updateSettings(partial) {
  settings = { ...settings, ...partial };
  return settings;
}
