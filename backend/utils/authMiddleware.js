// utils/authMiddleware.js
// Express middleware for authentication gating in PixelFree.
//
// Provides guard functions that check whether the backend
// currently has valid authentication state.
//
// Usage example:
//   import { ensureAuthed } from '../utils/authMiddleware.js';
//   router.use('/albums', ensureAuthed, albumsRoutes);

import * as auth from '../modules/auth.js';

/**
 * Middleware: allow request to proceed only if authenticated.
 * Otherwise respond with HTTP 401 and a small JSON error payload.
 */
export function ensureAuthed(req, res, next) {
  const status = auth.getStatus?.();
  if (status?.isAuthenticated) {
    return next();
  }
  return res.status(401).json({ error: 'Not authenticated' });
}

/**
 * (Optional) Middleware: allow request only if authenticated,
 * otherwise redirect to login flow. Useful for web UI routes,
 * but not typically for API endpoints.
 */
export function redirectIfNotAuthed(req, res, next) {
  const status = auth.getStatus?.();
  if (status?.isAuthenticated) {
    return next();
  }
  // Send back to frontend or trigger OAuth login page
  const loginUrl = auth.getLoginUrl?.();
  if (loginUrl) {
    return res.redirect(loginUrl);
  }
  return res.status(401).json({ error: 'Not authenticated' });
}