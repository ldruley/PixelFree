import type { PlayerSettings } from '../contexts/SettingsContext'
import { API_CONFIG } from '../config'

const PLAYER_SETTINGS_BASE_URL = `${API_CONFIG.BASE_URL}/api/settings/player`

export type UpdatePlayerSettingsRequest = Partial<PlayerSettings>

/**
 * Get the current player settings from the backend.
 * Backend returns: { settings: { ... } }
 */
export const getPlayerSettings = async (): Promise<PlayerSettings> => {
    try {
        const response = await fetch(PLAYER_SETTINGS_BASE_URL, {
            method: 'GET',
            credentials: 'include',
        })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        return data.settings as PlayerSettings
    } catch (error) {
        console.error('Failed to get player settings:', error)
        throw new Error('Unable to fetch player settings. Please try again.')
    }
}

/**
 * PATCH – partial update of player settings
 * Body example:
 * { layout: "grid", timing: "30s", activeAlbum: "vacation-2024" }
 */
export const updatePlayerSettings = async (
    updates: UpdatePlayerSettingsRequest
): Promise<PlayerSettings> => {
    try {
        const response = await fetch(PLAYER_SETTINGS_BASE_URL, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(updates),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(
                errorData.error?.message ||
                `HTTP ${response.status}: ${response.statusText}`
            )
        }

        const data = await response.json()
        return data.settings as PlayerSettings
    } catch (error) {
        console.error('Failed to update player settings:', error)
        if (error instanceof Error) throw error
        throw new Error('Unable to update player settings. Please try again.')
    }
}

/**
 * PUT – replace all player settings
 */
export const replacePlayerSettings = async (
    newSettings: PlayerSettings
): Promise<PlayerSettings> => {
    try {
        const response = await fetch(PLAYER_SETTINGS_BASE_URL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(newSettings),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(
                errorData.error?.message ||
                `HTTP ${response.status}: ${response.statusText}`
            )
        }

        const data = await response.json()
        return data.settings as PlayerSettings
    } catch (error) {
        console.error('Failed to replace player settings:', error)
        if (error instanceof Error) throw error
        throw new Error('Unable to save player settings. Please try again.')
    }
}

/**
 * Reset player settings to defaults using backend endpoint
 * POST /api/settings/player/reset
 */
export const resetPlayerSettings = async (): Promise<PlayerSettings> => {
    try {
        const response = await fetch(`${PLAYER_SETTINGS_BASE_URL}/reset`, {
            method: 'POST',
            credentials: 'include',
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(
                errorData.error?.message ||
                `HTTP ${response.status}: ${response.statusText}`
            )
        }

        const data = await response.json()
        return data.settings as PlayerSettings
    } catch (error) {
        console.error('Failed to reset player settings:', error)
        if (error instanceof Error) throw error
        throw new Error('Unable to reset player settings. Please try again.')
    }
}
