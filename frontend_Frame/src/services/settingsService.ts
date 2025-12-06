export type PlayerLayout = 'single' | 'grid' | 'split'
export type PlayerTransition = 'none' | 'fade' | 'slide'
export type PlayerOrder = 'fixed' | 'shuffle'
export type PlayerBackground = 'black' | 'gradient' | 'blur'

export type PlayerSettings = {
    layout: PlayerLayout
    transition: PlayerTransition
    timing: string
    order: PlayerOrder
    startTime: string
    endTime: string
    maxImages: number
    recencyWindow: number
    activeAlbum: string
    background?: PlayerBackground
}

export const DEFAULT_SETTINGS: PlayerSettings = {
    layout: 'single',
    transition: 'fade',
    timing: '10s',
    order: 'shuffle',
    startTime: '08:00',
    endTime: '22:00',
    maxImages: 100,
    recencyWindow: 30,
    activeAlbum: 'favorites',
    background: 'black',
}

type PlayerSettingsApiResponse = {
    settings?: Partial<PlayerSettings>
}

/**
 * Fetch settings from the backend and return just the partial settings object.
 * Does NOT apply defaults – caller can decide how to merge.
 */
export async function fetchPlayerSettings(): Promise<Partial<PlayerSettings>> {
    const res = await fetch('/api/settings/player')
    if (!res.ok) {
        throw new Error(`Failed to fetch player settings: ${res.status}`)
    }
    const data = (await res.json()) as PlayerSettingsApiResponse
    return data?.settings ?? {}
}
