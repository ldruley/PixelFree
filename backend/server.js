/**
 * server.js
 *
 * Main entry point for the OtterConnect backend server.
 *
 * This module is responsible for initializing and starting the Express.js
 * application, configuring global middleware, routing, and error handling.
 * It also establishes the connection to the underlying MySQL database and
 * ensures that application-wide configuration values are applied at startup.
 *
 * Key responsibilities:
 * - Load and configure environment variables to manage deployment settings
 *   (e.g., database credentials, ports, API keys).
 * - Initialize the Express app, apply JSON/body parsers, CORS settings, and
 *   any other middleware required globally across routes.
 * - Import and mount API route modules, providing a clean separation of
 *   functionality (e.g., authentication, user management, or application-specific
 *   features).
 * - Centralize error handling by using the error mapper utility to translate
 *   low-level errors (database, validation, etc.) into consistent HTTP responses.
 * - Start the HTTP server on the designated port and log a startup message to
 *   confirm the backend is online.
 *
 * In short, this file wires together the components defined in the rest of
 * the backend codebase and is the process entry point when launching the
 * application with Node.js.
 */

import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// ES module __dirname setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// JSON body parsing
app.use(express.json());

// Serve static frontend test files from the "public" directory.
//
// This is here to support a minimal, throwaway frontend for testing the backend’s
// Pixelfed authentication and photo-fetch flow without requiring a full frontend
// build or separate dev server. It allows us to open a browser at the backend’s URL
// (e.g., http://localhost:3000) and interact with a basic HTML/JS page.
//
// Best practice: In the long term, we should remove or replace this with a proper
// dedicated frontend project (e.g., React or Vue) in its own directory, using a
// development proxy to the backend during local development. Keeping this here
// too long can lead to confusion between the test UI and the production UI.
//
// TL;DR — Small frontend to test the backend. Not for production!

app.use(express.static('public'));

// --- Import modules ---
import mountAlbumRoutes from './api/albumsRoutes.js';
import mountAuthRoutes from './api/authRoutes.js';
import mountCacheSettingsRoutes from './api/cacheSettingsRoutes.js';
import mountPhotosRoutes from './api/photosRoutes.js';
import mountHealthRoutes from './api/healthRoutes.js';

import { asyncHandler, errorMapper } from './utils/errorMapper.js';
import { ValidationError } from './modules/errors.js';

// --- API Routes ---

// Root
app.get('/', (_req, res) => {
  res.type('text').send('PixelFree backend is running. Try /api/photos');
});

mountPhotosRoutes(app);
mountAuthRoutes(app);
mountCacheSettingsRoutes(app);
mountHealthRoutes(app);
mountAlbumRoutes(app, {
  // ensureAuthed, // uncomment if you want to require auth
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`✅ PixelFree backend listening at http://localhost:${PORT}`);
  console.log(`   Navigate to http://localhost:${PORT}/`);
});

// Final error mapper (must be after all routes/middleware)
app.use(errorMapper);