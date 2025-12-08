/**
 * utils/photoHelpers.js
 * ---------------------
 * Helper utilities for photo object manipulation.
 *
 * Primary purpose: Transform photo URLs to point to cache-aware media
 * endpoints when requested, enabling transparent caching while maintaining
 * backward compatibility with remote CDN URLs.
 */

/**
 * Get backend base URL for constructing absolute URLs.
 *
 * Priority order:
 * 1. BACKEND_URL environment variable (production)
 * 2. Constructed from request headers (auto-detection)
 * 3. Empty string (localhost/relative URLs for development)
 *
 * @param {object} [req] - Express request object
 * @returns {string} - Backend base URL or empty string
 *
 * @example
 * // Production with env var
 * process.env.BACKEND_URL = 'http://192.168.1.100:3000'
 * getBackendBaseUrl(req) // 'http://192.168.1.100:3000'
 *
 * @example
 * // Development without env var
 * getBackendBaseUrl(req) // '' (relative URLs)
 */
function getBackendBaseUrl(req) {
    // 1. Environment variable (most reliable for production)
    if (process.env.BACKEND_URL) {
        return process.env.BACKEND_URL.replace(/\/$/, ''); // Remove trailing slash
    }

    // 2. Construct from request headers (works with reverse proxy)
    if (req?.headers) {
        const protocol = req.headers['x-forwarded-proto'] ||
            (req.secure ? 'https' : 'http');
        const host = req.headers['x-forwarded-host'] || req.headers.host;

        if (host) {
            // Only use auto-detection if not localhost
            // This ensures dev environment uses relative URLs
            if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
                return `${protocol}://${host}`;
            }
        }
    }

    // 3. Return empty string = relative URLs (development/localhost)
    return '';
}

/**
 * Transform photo URLs to use cache-aware media endpoints.
 *
 * This function modifies photo objects to use local cache endpoints
 * (/api/media/* or /api/player/media/*) instead of remote CDN URLs.
 * Original remote URLs are preserved as *_remote fields for fallback.
 *
 * URLs are absolute (with backend host) when BACKEND_URL is set,
 * or relative (for localhost) when not set.
 *
 * @param {Array<object>|object} photos - Single photo or array of photos
 * @param {object} [options] - Transformation options
 * @param {boolean} [options.useCache=false] - Whether to transform URLs
 * @param {string} [options.source='management'] - Access source ('player' or 'management')
 * @param {object} [options.req] - Express request object for URL construction
 * @returns {Array<object>|object} - Transformed photos (maintains input type)
 *
 * @example
 * // Development (localhost) - relative URLs
 * const photos = transformPhotoUrls(rawPhotos, {
 *   useCache: true,
 *   source: 'management',
 *   req
 * });
 * // Result: preview_url = '/api/media/123/preview'
 *
 * @example
 * // Production (network) - absolute URLs
 * process.env.BACKEND_URL = 'http://192.168.1.100:3000'
 * const photos = transformPhotoUrls(rawPhotos, {
 *   useCache: true,
 *   source: 'player',
 *   req
 * });
 * // Result: preview_url = 'http://192.168.1.100:3000/api/player/media/123/preview'
 */
export function transformPhotoUrls(photos, options = {}) {
    const { useCache = false, source = 'management', req } = options;

    // If caching not requested, return as-is
    if (!useCache) {
        return photos;
    }

    // Get backend base URL (empty for localhost, absolute for network)
    const backendUrl = getBackendBaseUrl(req);

    // Determine URL prefix based on source
    // Player endpoints touch LRU, management endpoints don't
    const prefix = source === 'player' ? '/api/player/media' : '/api/media';

    // Combine backend URL with prefix
    const fullPrefix = backendUrl ? `${backendUrl}${prefix}` : prefix;

    // Handle single photo object
    if (photos && !Array.isArray(photos)) {
        return transformSinglePhoto(photos, fullPrefix);
    }

    // Handle array of photos
    if (!Array.isArray(photos)) {
        return photos;
    }

    return photos.map(photo => transformSinglePhoto(photo, fullPrefix));
}

/**
 * Transform a single photo object's URLs.
 *
 * @param {object} photo - Photo object with preview_url and url fields
 * @param {string} prefix - URL prefix ('/api/media' or '/api/player/media')
 * @returns {object} - Transformed photo object
 * @private
 */
function transformSinglePhoto(photo, prefix) {
    if (!photo || typeof photo !== 'object') {
        return photo;
    }

    // Skip transformation if no status_id (malformed photo object)
    if (!photo.status_id) {
        return photo;
    }

    return {
        ...photo,
        // Preserve original remote URLs as backup
        preview_url_remote: photo.preview_url,
        url_remote: photo.url,

        // Transform to cache-aware endpoints
        preview_url: `${prefix}/${photo.status_id}/preview`,
        url: `${prefix}/${photo.status_id}/original`,

        // Flag indicating URLs have been transformed
        use_cache: true
    };
}

/**
 * Extract cache configuration from request query parameters.
 *
 * Helper to standardize how we read cache-related query params
 * across different endpoints. Includes request object for URL construction.
 *
 * @param {object} query - Express request query object
 * @param {object} [req] - Express request object (for backend URL detection)
 * @returns {object} - Cache configuration
 * @property {boolean} useCache - Whether to use cache-aware URLs
 * @property {string} source - Access source ('player' or 'management')
 * @property {object} req - Request object (for URL construction)
 *
 * @example
 * router.get('/photos', (req, res) => {
 *   const cacheConfig = getCacheConfig(req.query, req);
 *   const photos = transformPhotoUrls(rawPhotos, cacheConfig);
 *   res.json(photos);
 * });
 */
export function getCacheConfig(query, req) {
    return {
        useCache: query.use_cache === 'true',
        source: query.source === 'player' ? 'player' : 'management',
        req  // Pass request for backend URL detection
    };
}

/**
 * Check if a photo object has cache-aware URLs.
 *
 * @param {object} photo - Photo object to check
 * @returns {boolean} - True if URLs have been transformed
 */
export function hasCacheUrls(photo) {
    if (!photo || typeof photo !== 'object') {
        return false;
    }

    return photo.use_cache === true ||
        (photo.preview_url && photo.preview_url.startsWith('/api/'));
}

/**
 * Restore original remote URLs from a transformed photo.
 *
 * Useful for debugging or when you need to bypass cache and
 * access CDN directly.
 *
 * @param {object} photo - Transformed photo object
 * @returns {object} - Photo with remote URLs restored
 */
export function restoreRemoteUrls(photo) {
    if (!photo || typeof photo !== 'object') {
        return photo;
    }

    if (!photo.preview_url_remote && !photo.url_remote) {
        // Not transformed, return as-is
        return photo;
    }

    return {
        ...photo,
        preview_url: photo.preview_url_remote || photo.preview_url,
        url: photo.url_remote || photo.url,
        use_cache: false
    };
}