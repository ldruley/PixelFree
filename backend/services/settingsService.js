// backend/services/settingsService.js
// Service for managing frontend and player settings stored in the KV store
//
// Settings are namespaced by type to allow flexible storage:
// - 'frontend:*' keys for management UI settings
// - 'player:*' keys for photo frame display settings
// - 'player-state:*' keys for runtime playback state

import * as kv from '../db/kvRepo.js';
import {ValidationError} from "../modules/errors.js";


// Default settings for the player (photo frame)
const DEFAULT_PLAYER_SETTINGS = {
    layout: 'single',
    transition: 'fade',
    timing: '10s',
    order: 'shuffle',
    startTime: '08:00',
    endTime: '22:00',
    maxImages: 100,
    recencyWindow: 30,
    activeAlbum: 'favorites',
    background:'blur'
};

// Valid values for player settings
// Only used for warnings, not strict validation
const VALID_LAYOUTS = ['single', 'grid', 'split'];
const VALID_TRANSITIONS = ['none', 'fade', 'slide'];
const VALID_TIMINGS = ['10s', '30s', '1m'];
const VALID_ORDERS = ['fixed', 'shuffle'];
const VALID_BACKGROUND = ['black' , 'blur' , 'gradient'];

/**
 * Get settings for a specific namespace and key
 * @param {string} namespace - e.g., 'frontend', 'player', 'player-state'
 * @param {string} key - setting key within the namespace
 * @param {*} defaultValue - default if not found
 * @returns {object|null}
 */
export function get(namespace, key, defaultValue = null) {
    const fullKey = `${namespace}:${key}`;
    const value = kv.get(fullKey);

    if (!value) {
        return defaultValue;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        console.error(`Failed to parse settings for ${fullKey}:`, error);
        return defaultValue;
    }
}

/**
 * Set settings for a specific namespace and key
 * @param {string} namespace
 * @param {string} key
 * @param {object} value - will be JSON stringified
 */
export function set(namespace, key, value) {
    if (typeof value !== 'object' || value === null) {
        throw new ValidationError('Settings value must be an object');
    }

    const fullKey = `${namespace}:${key}`;
    const jsonValue = JSON.stringify(value);
    kv.set(fullKey, jsonValue);
}

/**
 * Remove settings for a specific namespace and key
 * @param {string} namespace
 * @param {string} key
 * @returns {boolean} true if removed
 */
export function remove(namespace, key) {
    const fullKey = `${namespace}:${key}`;
    return kv.remove(fullKey);
}

/**
 * List all settings for a namespace
 * @param {string} namespace
 * @returns {Array<{key: string, value: object}>}
 */
export function listByNamespace(namespace) {
    const prefix = `${namespace}:`;
    const allKv = kv.list();

    return allKv
        .filter(item => item.k.startsWith(prefix))
        .map(item => {
            const key = item.k.substring(prefix.length);
            try {
                return { key, value: JSON.parse(item.v) };
            } catch (error) {
                console.error(`Failed to parse ${item.k}:`, error);
                return { key, value: null };
            }
        });
}

/**
 * Validate player settings (lightweight validation)
 * @param {object} settings
 * @throws {ValidationError} if invalid
 *
 * Note: Validation is intentionally minimal to allow schema flexibility.
 * Only validates basic structure, not specific field values.
 */
function validatePlayerSettings(settings) {
    // Just ensure it's an object - no field-level validation
    // This allows the schema to evolve without backend changes
    if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
        throw new ValidationError('Settings must be a valid object');
    }

    // Log warnings for unexpected values but don't block
    if (process.env.NODE_ENV !== 'production') {
        if (settings.layout && !VALID_LAYOUTS.includes(settings.layout)) {
            console.warn(`[Settings] Unexpected layout value: ${settings.layout}`);
        }
        if (settings.transition && !VALID_TRANSITIONS.includes(settings.transition)) {
            console.warn(`[Settings] Unexpected transition value: ${settings.transition}`);
        }
        if (settings.timing && !VALID_TIMINGS.includes(settings.timing)) {
            console.warn(`[Settings] Unexpected timing value: ${settings.timing}`);
        }
    }
}

/**
 * Get player settings (with defaults)
 * @returns {object} player settings
 */
export function getPlayerSettings() {
    const saved = get('player', 'settings');
    return { ...DEFAULT_PLAYER_SETTINGS, ...saved };
}

/**
 * Update player settings (partial update)
 * @param {object} updates - partial settings to update
 * @returns {object} updated settings
 */
export function updatePlayerSettings(updates) {
    validatePlayerSettings(updates);

    const current = getPlayerSettings();
    const updated = { ...current, ...updates };

    set('player', 'settings', updated);
    return updated;
}

/**
 * Reset player settings to defaults
 * @returns {object} default settings
 */
export function resetPlayerSettings() {
    set('player', 'settings', DEFAULT_PLAYER_SETTINGS);
    return { ...DEFAULT_PLAYER_SETTINGS };
}

/**
 * Get current player state (what's actively playing)
 * @returns {object|null}
 */
export function getPlayerState() {
    return get('player-state', 'current');
}

/**
 * Update player state
 * @param {object} state
 * @returns {object}
 */
export function updatePlayerState(state) {
    const timestamp = new Date().toISOString();
    const stateWithTimestamp = { ...state, lastUpdated: timestamp };

    set('player-state', 'current', stateWithTimestamp);
    return stateWithTimestamp;
}

/**
 * Get frontend settings for a specific key
 * @param {string} key - setting key (e.g., 'preferences', 'ui-state')
 * @param {*} defaultValue
 * @returns {object|null}
 */
export function getFrontendSettings(key, defaultValue = null) {
    return get('frontend', key, defaultValue);
}

/**
 * Set frontend settings for a specific key
 * @param {string} key
 * @param {object} value
 */
export function setFrontendSettings(key, value) {
    if (!key || typeof key !== 'string') {
        throw new ValidationError('Settings key must be a non-empty string');
    }

    set('frontend', key, value);
}

/**
 * Remove frontend settings for a specific key
 * @param {string} key
 * @returns {boolean}
 */
export function removeFrontendSettings(key) {
    return remove('frontend', key);
}

/**
 * List all frontend settings
 * @returns {Array<{key: string, value: object}>}
 */
export function listFrontendSettings() {
    return listByNamespace('frontend');
}