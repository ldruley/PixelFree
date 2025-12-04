/**
 * utils/mediaStorage.js
 * ----------------------
 * Filesystem utilities for media cache management.
 *
 * Responsibilities:
 * - Generate hashed directory paths to prevent filesystem bottlenecks
 * - Create directory structures atomically
 * - Download media files from remote URLs
 * - Atomic file writes to prevent corruption
 * - Parse HTTP cache headers (Cache-Control, ETag, etc.)
 *
 * Directory structure:
 *   cache/media/ab/cd/<status_id>-<kind>.jpg
 *   where 'ab/cd' are derived from first 4 chars of status_id hash
 */

import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';

// Base directory for media cache (configurable via env)
const CACHE_ROOT = process.env.MEDIA_CACHE_PATH || path.join(process.cwd(), 'cache', 'media');

/**
 * Generate a hashed directory path for a given status_id.
 * Uses first 4 characters of MD5 hash to create two-level directory structure.
 *
 * Example: status_id "12345" -> "8b/c9"
 *
 * @param {string} statusId - The status/photo ID
 * @returns {string} - Hashed directory path (e.g., "ab/cd")
 */
export function getHashedPath(statusId) {
    const hash = crypto.createHash('md5').update(String(statusId)).digest('hex');
    const dir1 = hash.substring(0, 2);
    const dir2 = hash.substring(2, 4);
    return path.join(dir1, dir2);
}

/**
 * Get the full filesystem path for a cached media file.
 *
 * @param {string} statusId - The status/photo ID
 * @param {string} kind - Media type ('preview' or 'original')
 * @param {string} [extension='jpg'] - File extension
 * @returns {string} - Full absolute path to the media file
 */
export function getMediaPath(statusId, kind, extension = 'jpg') {
    const hashedDir = getHashedPath(statusId);
    const filename = `${statusId}-${kind}.${extension}`;
    return path.join(CACHE_ROOT, hashedDir, filename);
}

/**
 * Get the relative path (from CACHE_ROOT) for database storage.
 *
 * @param {string} statusId - The status/photo ID
 * @param {string} kind - Media type ('preview' or 'original')
 * @param {string} [extension='jpg'] - File extension
 * @returns {string} - Relative path from cache root
 */
export function getRelativePath(statusId, kind, extension = 'jpg') {
    const hashedDir = getHashedPath(statusId);
    const filename = `${statusId}-${kind}.${extension}`;
    return path.join(hashedDir, filename);
}

/**
 * Ensure the directory structure exists for a given file path.
 *
 * @param {string} filePath - Full path to the file
 * @returns {Promise<void>}
 */
export async function ensureDirectory(filePath) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
}


/**
 * Parse Cache-Control header to extract max-age in seconds.
 *
 * @param {string} cacheControl - Cache-Control header value
 * @returns {number|null} - max-age in seconds, or null if not found
 */
export function parseCacheControl(cacheControl) {
    if (!cacheControl) return null;

    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
    if (maxAgeMatch) {
        return parseInt(maxAgeMatch[1], 10);
    }

    return null;
}

/**
 * Calculate expires_at timestamp based on TTL or Cache-Control.
 *
 * @param {object} options - Calculation options
 * @param {number} [options.maxAge] - max-age from Cache-Control (seconds)
 * @param {number} [options.defaultTtlDays=60] - Default TTL in days if no max-age
 * @returns {string} - ISO timestamp for expires_at
 */
export function calculateExpiresAt({ maxAge, defaultTtlDays = 60 } = {}) {
    const now = new Date();

    if (maxAge && maxAge > 0) {
        // Use Cache-Control max-age
        const expiresMs = now.getTime() + (maxAge * 1000);
        return new Date(expiresMs).toISOString();
    }

    // Use default TTL
    const expiresMs = now.getTime() + (defaultTtlDays * 24 * 60 * 60 * 1000);
    return new Date(expiresMs).toISOString();
}

/**
 * Infer file extension from URL or content-type.
 *
 * @param {string} url - Media URL
 * @param {string} [contentType] - Content-Type header value
 * @returns {string} - File extension (without dot)
 */
export function inferExtension(url, contentType) {
    // Try content-type first
    if (contentType) {
        if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) return 'jpg';
        if (contentType.includes('image/png')) return 'png';
        if (contentType.includes('image/gif')) return 'gif';
        if (contentType.includes('image/webp')) return 'webp';
    }

    // Fall back to URL extension
    const urlPath = new URL(url).pathname;
    const ext = path.extname(urlPath).toLowerCase().substring(1);
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        return ext === 'jpeg' ? 'jpg' : ext;
    }

    // Default to jpg
    return 'jpg';
}

/**
 * Download a media file from a remote URL and save it to disk atomically.
 * Returns metadata about the download including file size and cache headers.
 *
 * @param {string} url - Remote media URL
 * @param {string} destinationPath - Full filesystem path where file should be saved
 * @param {object} [options] - Download options
 * @param {object} [options.headers] - Additional HTTP headers to send
 * @param {number} [options.timeout=30000] - Request timeout in milliseconds
 * @returns {Promise<object>} - Download result with metadata
 * @property {number} contentLength - File size in bytes
 * @property {string|null} etag - ETag header value if present
 * @property {number|null} maxAge - Cache-Control max-age if present
 */
export async function downloadMedia(url, destinationPath, options = {}) {
    const { headers = {}, timeout = 30000 } = options;

    // Ensure directory exists
    await ensureDirectory(destinationPath);

    // Use AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            headers,
            signal: controller.signal
        });

        if (!response.ok) {
            clearTimeout(timeoutId);
            return Promise.reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
        }

        // Extract headers
        const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
        const etag = response.headers.get('etag');
        const cacheControl = response.headers.get('cache-control');
        const maxAge = parseCacheControl(cacheControl);

        // Write to temporary file first (atomic write)
        const tempPath = `${destinationPath}.tmp`;
        const fileStream = createWriteStream(tempPath);

        // Pipe response to file
        await pipeline(response.body, fileStream);

        // Atomically rename temp file to final destination
        await fs.rename(tempPath, destinationPath);

        clearTimeout(timeoutId);

        return {
            contentLength,
            etag,
            maxAge,
            cacheControl
        };
    } catch (error) {
        clearTimeout(timeoutId);

        // Clean up temp file if it exists
        try {
            await fs.unlink(`${destinationPath}.tmp`).catch(() => {});
        } catch {}

        // Enhance error message
        if (error.name === 'AbortError') {
            throw new Error(`Download timeout after ${timeout}ms: ${url}`);
        }

        throw error;
    }
}

/**
 * Delete a media file from disk.
 *
 * @param {string} filePath - Full path to the file to delete
 * @returns {Promise<boolean>} - True if deleted, false if file didn't exist
 */
export async function deleteMedia(filePath) {
    try {
        await fs.unlink(filePath);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return false; // File didn't exist
        }
        throw error;
    }
}

/**
 * Get file statistics including size and modification time.
 *
 * @param {string} filePath - Full path to the file
 * @returns {Promise<object|null>} - File stats or null if doesn't exist
 * @property {number} size - File size in bytes
 * @property {Date} mtime - Last modification time
 */
export async function getFileStats(filePath) {
    try {
        const stats = await fs.stat(filePath);
        return {
            size: stats.size,
            mtime: stats.mtime
        };
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

/**
 * Verify that a file exists and matches expected size.
 *
 * @param {string} filePath - Full path to the file
 * @param {number} [expectedSize] - Expected file size in bytes (optional)
 * @returns {Promise<boolean>} - True if file exists and size matches (if provided)
 */
export async function verifyFile(filePath, expectedSize) {
    const stats = await getFileStats(filePath);
    if (!stats) return false;

    return !(expectedSize !== undefined && stats.size !== expectedSize);
}

/**
 * Get the cache root directory path.
 *
 * @returns {string} - Absolute path to cache root
 */
export function getCacheRoot() {
    return CACHE_ROOT;
}

/**
 * Initialize the cache directory structure.
 * Should be called on application startup.
 *
 * @returns {Promise<void>}
 */
export async function initializeCacheDirectory() {
    await fs.mkdir(CACHE_ROOT, { recursive: true });
}