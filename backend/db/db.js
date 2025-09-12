// db.js — PixelFree SQLite singleton (better-sqlite3)
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Where to store the DB file (override via PIXELFREE_DB_PATH)
const DB_PATH = process.env.PIXELFREE_DB_PATH || path.join(process.cwd(), 'pixelfree.db');
// Schema file that will be executed on startup (idempotent)
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Create a single connection for the whole process
const db = new Database(DB_PATH);

// Pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema (idempotent)
try {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
} catch (err) {
  // If schema.sql is missing, surface a clear error to help setup
  if (err && err.code === 'ENOENT') {
    console.error(`[db] schema.sql not found at ${SCHEMA_PATH}. Make sure it exists.`);
  }
  throw err;
}

// Export the singleton connection
export default db;