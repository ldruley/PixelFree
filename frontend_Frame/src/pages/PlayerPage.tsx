import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Photo } from '../services/photoService'
import { getAlbumPhotos, listAlbums } from '../services/albumService'
import { useSettings } from '../contexts/SettingsContext'
import Header from '../components/Header'

const PlayerPage: React.FC = () => {
  const navigate = useNavigate()
  const { settings, isWithinOperatingHours, getTimingInMs } = useSettings()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showHeader, setShowHeader] = useState(false)
  const hideTimerRef = useRef<number | null>(null)
  const [isPaused] = useState(false)
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | 'none'>('none')
  const [isTransitioning, setIsTransitioning] = useState(false)

  const shuffleArray = (array: number[]): number[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  useEffect(() => {
    const loadPhotos = async () => {
      try {
        setLoading(true)
        setError(null)

        const albumsResponse = await listAlbums({ limit: 100 })
        let activeAlbum = albumsResponse.items.find(a => a.id === settings.activeAlbum)
        if (!activeAlbum) activeAlbum = albumsResponse.items.find(a => a.enabled)
        if (!activeAlbum) activeAlbum = albumsResponse.items.find(a => a.id === 'favorites_builtin')

        if (!activeAlbum) {
          setError('No albums available. Please create an album first.')
          return
        }

        const photosResponse = await getAlbumPhotos(activeAlbum.id, { limit: settings.maxImages || 100 })

        if (photosResponse.items.length === 0) {
          setError(`No photos in album "${activeAlbum.name}". Try refreshing the album.`)
          return
        }

        setPhotos(photosResponse.items)

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

  const getCurrentPhoto = (): Photo | null => {
    if (photos.length === 0) return null
    const photoIndex = settings.order === 'shuffle' ? shuffledIndices[currentIndex] : currentIndex
    return photos[photoIndex] || null
  }

  const getPhotosForLayout = (): Photo[] => {
    if (photos.length === 0) return []

    switch (settings.layout) {
      case 'grid': {
        const gridPhotos: Photo[] = []
        for (let i = 0; i < 4; i++) {
          const index = (currentIndex + i) % photos.length
          const photoIndex = settings.order === 'shuffle' ? shuffledIndices[index] : index
          if (photos[photoIndex]) gridPhotos.push(photos[photoIndex])
        }
        return gridPhotos
      }
      case 'split': {
        const splitPhotos: Photo[] = []
        for (let i = 0; i < 2; i++) {
          const index = (currentIndex + i) % photos.length
          const photoIndex = settings.order === 'shuffle' ? shuffledIndices[index] : index
          if (photos[photoIndex]) splitPhotos.push(photos[photoIndex])
        }
        return splitPhotos
      }
      default:
        return [getCurrentPhoto()].filter(Boolean) as Photo[]
    }
  }

  useEffect(() => {
    if (photos.length === 0 || isPaused || !isWithinOperatingHours()) return

    const interval = window.setInterval(() => {
      if (settings.transition === 'slide') {
        setSlideDirection('left')
        setIsTransitioning(true)
        window.setTimeout(() => {
          setCurrentIndex(prev => (prev + 1) % photos.length)
          window.setTimeout(() => {
            setSlideDirection('none')
            setIsTransitioning(false)
          }, 50)
        }, 500)
      } else {
        setCurrentIndex(prev => (prev + 1) % photos.length)
      }
    }, getTimingInMs())

    return () => window.clearInterval(interval)
  }, [photos.length, isPaused, getTimingInMs, isWithinOperatingHours, settings.transition])

  useEffect(() => {
    if (settings.order === 'shuffle' && photos.length > 0) {
      const indices = Array.from({ length: photos.length }, (_, i) => i)
      const shuffled = shuffleArray(indices)
      setShuffledIndices(shuffled)
      setCurrentIndex(0)
    }
  }, [settings.order, photos.length])

  useEffect(() => {
    setShowHeader(true)
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => setShowHeader(false), 1800)
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    }
  }, [])

  const handleRootClick = () => {
    setShowHeader(prev => !prev)
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => setShowHeader(false), 3000)
  }

  const stopPropagation: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation()
  }

  const goSettings = useCallback(() => {
    try {
      navigate('/settings')
    } catch (error) {
      console.error('Navigation error:', error)
      window.location.href = '/settings'
    }
  }, [navigate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault()
        goSettings()
      }
      if (e.code === 'Space') {
        e.preventDefault()
        setShowHeader(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goSettings])

  const displayPhotos = getPhotosForLayout()
  const bgPhotoUrl = (displayPhotos[0] || getCurrentPhoto())?.url

  // Status
  const outsideHours = !isWithinOperatingHours()

  // Screens
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
            <p className="text-lg opacity-75">Active from {settings.startTime} to {settings.endTime}</p>
            <button
                onClick={goSettings}
                className="mt-8 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white font-medium"
            >
              Open Settings
            </button>
          </div>
        </div>
    )
  }

  return (
      <div
          className="fixed inset-0 bg-black overflow-hidden relative select-none"
          onClick={handleRootClick}
          role="button"
          aria-label="Toggle header"
          tabIndex={0}
      >
        {bgPhotoUrl && (
            <div
                className="absolute inset-0 -z-10 bg-center bg-cover"
                style={{
                  backgroundImage: `url(${bgPhotoUrl})`,
                  filter: 'blur(40px) brightness(0.5)',
                  transform: 'scale(1.08)'
                }}
                aria-hidden
            />
        )}
        {showHeader && (
            <div
                className="absolute top-0 left-0 right-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300"
                onClick={stopPropagation}
            >
              <Header />
            </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center">
          {settings.layout === 'single' && (
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                <div
                    className={`relative z-10 transition-transform duration-500 ease-in-out ${
                        settings.transition === 'slide' && isTransitioning
                            ? slideDirection === 'left'
                                ? '-translate-x-full'
                                : slideDirection === 'right'
                                    ? 'translate-x-full'
                                    : 'translate-x-0'
                            : 'translate-x-0'
                    }`}
                >
                  <img
                      src={displayPhotos[0]?.url}
                      alt={displayPhotos[0]?.caption || 'Photo'}
                      className={`${settings.transition === 'fade' ? 'transition-opacity duration-500' : ''} rounded-xl shadow-2xl select-none`}
                      style={{ width: '80vw', height: '80vh', objectFit: 'contain' }}
                      draggable={false}
                  />
                </div>
              </div>
          )}

          {settings.layout === 'grid' && (
              <div className="grid grid-cols-2 gap-4 w-full h-full p-6">
                {displayPhotos.slice(0, 4).map((photo, index) => (
                    photo && (
                        <div key={`${photo.id}-${index}`} className="flex items-center justify-center bg-black/30 rounded-xl">
                          <img
                              src={photo.url}
                              alt={photo.caption || `Photo ${index + 1}`}
                              className="rounded-lg shadow-xl"
                              style={{ width: '38vw', height: '38vh', objectFit: 'contain' }}
                              draggable={false}
                          />
                        </div>
                    )
                ))}
              </div>
          )}

          {settings.layout === 'split' && (
              <div className="flex w-full h-full gap-4 p-6">
                {displayPhotos.slice(0, 2).map((photo, index) => (
                    photo && (
                        <div key={`${photo.id}-${index}`} className="flex-1 flex items-center justify-center bg-black/30 rounded-xl">
                          <img
                              src={photo.url}
                              alt={photo.caption || `Photo ${index + 1}`}
                              className="rounded-lg shadow-xl"
                              style={{ width: '75vw', height: '80vh', objectFit: 'contain' }}
                              draggable={false}
                          />
                        </div>
                    )
                ))}
              </div>
          )}
        </div>

        {showHeader && (
            <div className="absolute bottom-0 left-0 p-4 pointer-events-none z-40">
              <div className="bg-black/50 text-white px-3 py-2 rounded text-xs">
                <div className="flex gap-4">
                  <span>Layout: {settings.layout}</span>
                  <span>Order: {settings.order}</span>
                  <span>Timing: {getTimingInMs() / 1000}s</span>
                  <span>Transition: {settings.transition}</span>
                  <span className="opacity-75">(Tap to hide)</span>
                </div>
              </div>
            </div>
        )}
      </div>
  )
}

export default PlayerPage
