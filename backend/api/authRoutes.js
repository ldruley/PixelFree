// backend/api/authRoutes.js
// Auth routes expose authentication functionality to the client.

import express from 'express';
import * as auth from '../modules/auth.js';

// tiny async wrapper (so we don't depend on an external asyncHandler)
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export default function mountAuthRoutes(app) {
  const router = express.Router();

  // GET /api/login → return JSON { loginUrl }
  router.get('/login', (_req, res) => {
    console.log('[API] GET /api/login');
    const loginUrl = auth.getLoginUrl();
    res.json({ loginUrl });
  });

  // GET /api/callback → exchange code, save token, then redirect (to '/')
  router.get('/callback', wrap(async (req, res) => {
    console.log('[API] GET /api/callback' /*, req.query */);
    await auth.handleCallback(req.query);   // exchanges code + saves .token.json
    res.redirect('/');                      // or res.redirect('/api/auth/status')
  }));

  // GET /api/auth/status → return current auth status JSON
  router.get('/auth/status', (_req, res) => {
    console.log('[API] GET /api/auth/status');
    res.json(auth.getStatus());
  });

  // POST /api/auth/logout → clear token, return { ok: true }
  router.post('/auth/logout', (_req, res) => {
    console.log('[API] POST /api/auth/logout');
    auth.logout();
    res.json({ ok: true });
  });

  // Mount under /api
  app.use('/api', router);
}