import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface PlayerSettings {
  // Layout settings
  layout: 'single' | 'grid' | 'split'
  
  // Transition settings
  transition: 'none' | 'fade' | 'slide'
  
  // Timing settings
  timing: '10s' | '30s' | '1m'
  
  // Order settings
  order: 'fixed' | 'shuffle'
  
  // Hours of operation
  startTime: string
  endTime: string
  
  // Limits
  maxImages: number
  recencyWindow: number
  
  // Active album
  activeAlbum: string
}

interface SettingsContextType {
  settings: PlayerSettings
  updateSettings: (newSettings: Partial<PlayerSettings>) => void
  resetSettings: () => void
  isWithinOperatingHours: () => boolean
  getTimingInMs: () => number
}

const defaultSettings: PlayerSettings = {
  layout: 'single',
  transition: 'fade',
  timing: '10s',
  order: 'shuffle',
  startTime: '08:00',
  endTime: '22:00',
  maxImages: 100,
  recencyWindow: 30,
  activeAlbum: 'favorites'
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

interface SettingsProviderProps {
  children: ReactNode
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<PlayerSettings>(defaultSettings)

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('pixelfree-player-settings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        console.log('Loading saved settings:', parsed)
        // Ensure all required fields are present by merging with defaults
        const mergedSettings = { ...defaultSettings, ...parsed }
        setSettings(mergedSettings)
      } catch (error) {
        console.error('Failed to parse saved settings:', error)
        setSettings(defaultSettings)
      }
    } else {
      console.log('No saved settings found, using defaults')
      setSettings(defaultSettings)
    }
  }, [])

  // Save settings to localStorage whenever they change (but skip initial default save)
  const [isInitialized, setIsInitialized] = useState(false)
  
  useEffect(() => {
    if (isInitialized) {
      console.log('Saving settings to localStorage:', settings)
      localStorage.setItem('pixelfree-player-settings', JSON.stringify(settings))
    }
  }, [settings, isInitialized])

  // Mark as initialized after first load
  useEffect(() => {
    const timer = setTimeout(() => setIsInitialized(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const updateSettings = (newSettings: Partial<PlayerSettings>) => {
    console.log('SettingsContext: updateSettings called with:', newSettings)
    setSettings(prev => {
      const updated = { ...prev, ...newSettings }
      console.log('SettingsContext: Updated settings:', updated)
      return updated
    })
  }

  const resetSettings = () => {
    console.log('Resetting settings to defaults')
    localStorage.removeItem('pixelfree-player-settings')
    setSettings(defaultSettings)
  }

  const isWithinOperatingHours = (): boolean => {
    const now = new Date()
    const currentTime = now.getHours() * 60 + now.getMinutes()
    
    const [startHour, startMin] = settings.startTime.split(':').map(Number)
    const [endHour, endMin] = settings.endTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    
    if (startMinutes <= endMinutes) {
      // Same day range
      return currentTime >= startMinutes && currentTime <= endMinutes
    } else {
      // Overnight range
      return currentTime >= startMinutes || currentTime <= endMinutes
    }
  }

  const getTimingInMs = (): number => {
    switch (settings.timing) {
      case '10s': return 10000
      case '30s': return 30000
      case '1m': return 60000
      default: return 10000
    }
  }

  const value: SettingsContextType = {
    settings,
    updateSettings,
    resetSettings,
    isWithinOperatingHours,
    getTimingInMs
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
