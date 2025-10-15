import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Photo } from '../services/photoService'
import { getAlbumPhotos, listAlbums } from '../services/albumService'
import { useSettings } from '../contexts/SettingsContext'

const PlayerPage: React.FC = () => {
  const navigate = useNavigate()
  const { settings, isWithinOperatingHours, getTimingInMs } = useSettings()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showControls, setShowControls] = useState(true)
  const [isPaused] = useState(false)
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | 'none'>('none')
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Debug: Log settings changes
  useEffect(() => {
    console.log('PlayerPage: Settings updated:', settings)
    console.log('PlayerPage: Layout is:', settings.layout)
    console.log('PlayerPage: Transition is:', settings.transition)
  }, [settings])

  // Fisher-Yates shuffle algorithm
  const shuffleArray = (array: number[]): number[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // Load photos from active album
  useEffect(() => {
    const loadPhotos = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Get all albums
        const albumsResponse = await listAlbums({ limit: 100 })
        
        // Find the active album based on settings
        let activeAlbum = albumsResponse.items.find(a => a.id === settings.activeAlbum)
        
        // Fallback to first enabled album if active album not found
        if (!activeAlbum) {
          activeAlbum = albumsResponse.items.find(a => a.enabled)
        }
        
        // Fallback to favorites
        if (!activeAlbum) {
          activeAlbum = albumsResponse.items.find(a => a.id === 'favorites_builtin')
        }
        
        if (!activeAlbum) {
          setError('No albums available. Please create an album first.')
          return
        }
        
        // Fetch photos from the active album
        const photosResponse = await getAlbumPhotos(activeAlbum.id, { limit: settings.maxImages || 100 })
        
        if (photosResponse.items.length === 0) {
          setError(`No photos in album "${activeAlbum.name}". Try refreshing the album.`)
          return
        }
        
        setPhotos(photosResponse.items)
        
        // Initialize shuffled indices
        const indices = Array.from({ length: photosResponse.items.length }, (_, i) => i)
        const shuffled = shuffleArray(indices)
        setShuffledIndices(shuffled)
        setCurrentIndex(0)
      } catch (err) {
        setError('Failed to load photos from album')
        console.error('Error loading photos:', err)
      } finally {
        setLoading(false)
      }
    }

    loadPhotos()
  }, [settings.activeAlbum, settings.maxImages])

  // Get photos for different layouts
  const getPhotosForLayout = () => {
    if (photos.length === 0) return []
    
    switch (settings.layout) {
      case 'grid':
        // Get 4 photos for 2x2 grid
        const gridPhotos = []
        for (let i = 0; i < 4; i++) {
          const index = (currentIndex + i) % photos.length
          const photoIndex = settings.order === 'shuffle' ? shuffledIndices[index] : index
          if (photos[photoIndex]) {
            gridPhotos.push(photos[photoIndex])
          }
        }
        return gridPhotos
        
      case 'split':
        // Get 2 photos for split view
        const splitPhotos = []
        for (let i = 0; i < 2; i++) {
          const index = (currentIndex + i) % photos.length
          const photoIndex = settings.order === 'shuffle' ? shuffledIndices[index] : index
          if (photos[photoIndex]) {
            splitPhotos.push(photos[photoIndex])
          }
        }
        return splitPhotos
        
      default:
        // Single photo
        return [getCurrentPhoto()].filter(Boolean)
    }
  }

  // Auto-advance slideshow based on settings
  useEffect(() => {
    if (photos.length === 0 || isPaused || !isWithinOperatingHours()) return

    const interval = setInterval(() => {
      if (settings.transition === 'slide') {
        console.log('Starting slide transition')
        setSlideDirection('left')
        setIsTransitioning(true)
        setTimeout(() => {
          setCurrentIndex(prev => (prev + 1) % photos.length)
          setTimeout(() => {
            setSlideDirection('none')
            setIsTransitioning(false)
          }, 50)
        }, 500)
      } else {
        setCurrentIndex(prev => (prev + 1) % photos.length)
      }
    }, getTimingInMs())

    return () => clearInterval(interval)
  }, [photos.length, isPaused, getTimingInMs, isWithinOperatingHours, settings.transition])

  // Re-shuffle when order changes to shuffle
  useEffect(() => {
    if (settings.order === 'shuffle' && photos.length > 0) {
      const indices = Array.from({ length: photos.length }, (_, i) => i)
      const shuffled = shuffleArray(indices)
      setShuffledIndices(shuffled)
      setCurrentIndex(0)
    }
  }, [settings.order, photos.length])

  // Auto-hide controls - simplified
  useEffect(() => {
    setShowControls(true)
    const timeout = setTimeout(() => {
      setShowControls(false)
    }, 3000)

    const handleMouseMove = () => {
      setShowControls(true)
      clearTimeout(timeout)
      setTimeout(() => setShowControls(false), 3000)
    }

    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      clearTimeout(timeout)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  // Handle exit to main page
  const handleExit = useCallback(() => {
    console.log('Exit button clicked!')
    try {
      navigate('/')
      console.log('Navigation called')
    } catch (error) {
      console.error('Navigation error:', error)
      // Fallback to window location
      window.location.href = '/'
    }
  }, [navigate])

  // Add ESC key to exit
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault()
        console.log('ESC key pressed - exiting')
        handleExit()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleExit])

  const displayPhotos = getPhotosForLayout()

  // Get current photo based on settings
  function getCurrentPhoto(): Photo | null {
    if (photos.length === 0) return null
    const photoIndex = settings.order === 'shuffle' ? shuffledIndices[currentIndex] : currentIndex
    return photos[photoIndex] || null
  }

  // Check if we're outside operating hours
  const outsideHours = !isWithinOperatingHours()

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading photos...</div>
      </div>
    )
  }

  if (error || displayPhotos.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-xl">{error || 'No photos available'}</div>
      </div>
    )
  }

  if (outsideHours) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Display Inactive</h2>
          <p className="text-xl mb-2">Outside operating hours</p>
          <p className="text-lg opacity-75">
            Active from {settings.startTime} to {settings.endTime}
          </p>
          <button
            onClick={handleExit}
            className="mt-8 px-6 py-3 bg-red-600/90 hover:bg-red-600 rounded-lg transition-colors text-white font-medium"
          >
            ✕ Exit
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Main photo display with different layouts */}
      <div className="absolute inset-0 flex items-center justify-center">
        {settings.layout === 'single' && (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            <div className={`absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-in-out ${
              settings.transition === 'slide' && isTransitioning ? 
                slideDirection === 'left' ? '-translate-x-full' : 
                slideDirection === 'right' ? 'translate-x-full' : 'translate-x-0'
              : 'translate-x-0'
            }`}>
              <img
                src={displayPhotos[0]?.url}
                alt={displayPhotos[0]?.caption || 'Photo'}
                className={`max-w-full max-h-full object-contain select-none ${
                  settings.transition === 'fade' ? 'transition-opacity duration-500' : ''
                }`}
              />
            </div>
          </div>
        )}

        {settings.layout === 'grid' && (
          <div className="grid grid-cols-2 gap-2 w-full h-full p-4">
            {displayPhotos.slice(0, 4).map((photo, index) => (
              photo && (
                <div key={`${photo.id}-${index}`} className="flex items-center justify-center bg-gray-900">
                  <img
                    src={photo.url}
                    alt={photo.caption || `Photo ${index + 1}`}
                    className="max-w-full max-h-full object-contain select-none"
                  />
                </div>
              )
            ))}
          </div>
        )}

        {settings.layout === 'split' && (
          <div className="flex w-full h-full">
            {displayPhotos.slice(0, 2).map((photo, index) => (
              photo && (
                <div key={`${photo.id}-${index}`} className="flex-1 flex items-center justify-center bg-gray-900">
                  <img
                    src={photo.url}
                    alt={photo.caption || `Photo ${index + 1}`}
                    className="max-w-full max-h-full object-contain select-none"
                  />
                </div>
              )
            ))}
          </div>
        )}
      </div>

      {/* Simple overlay with exit button - always visible */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top bar with exit button - always clickable */}
        <div className="absolute top-0 right-0 p-6 pointer-events-auto">
          <button
            onClick={handleExit}
            className={`px-6 py-3 bg-red-600/90 hover:bg-red-600 rounded-lg transition-all text-white font-medium shadow-lg ${
              showControls ? 'opacity-100' : 'opacity-70'
            }`}
          >
            ✕ Exit
          </button>
        </div>

        {/* Settings indicator */}
        {showControls && (
          <div className="absolute bottom-0 left-0 p-6 pointer-events-none">
            <div className="bg-black/50 text-white px-4 py-2 rounded-lg text-sm">
              <div className="flex space-x-4">
                <span>Layout: {settings.layout}</span>
                <span>Order: {settings.order}</span>
                <span>Timing: {getTimingInMs() / 1000}s</span>
                <span>Transition: {settings.transition}</span>
              </div>
            </div>
          </div>
        )}

        {/* Debug: Show current settings state */}
        <div className="absolute top-0 left-0 p-4 bg-red-500/80 text-white text-xs">
          <div>Layout: {settings.layout}</div>
          <div>Transition: {settings.transition}</div>
          <div>Photos: {displayPhotos.length}</div>
          <div>Transitioning: {isTransitioning ? 'YES' : 'NO'}</div>
          <div>Direction: {slideDirection}</div>
        </div>
      </div>
    </div>
  )
}

export default PlayerPage
