import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Photo } from '../services/photoService'
import { getAlbumPhotos, listAlbums } from '../services/albumService'
import Header from '../components/Header'
import '../styles/player.css'
import {
  DEFAULT_SETTINGS,
  fetchPlayerSettings,
  type PlayerSettings,
} from '../services/settingsService'

const TRANSITION_MS = 1200

const PlayerPage: React.FC = () => {
  const navigate = useNavigate()

  const [settings, setSettings] = useState<PlayerSettings>(DEFAULT_SETTINGS)
  const [settingsLoading, setSettingsLoading] = useState(true)

  const [photos, setPhotos] = useState<Photo[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showHeader, setShowHeader] = useState(false)
  const hideTimerRef = useRef<number | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [nextIndex, setNextIndex] = useState<number | null>(null)
  const [direction] = useState<'left' | 'right'>('left')
  const [nextReady, setNextReady] = useState(false)

  const effectiveSettings = settings || DEFAULT_SETTINGS

  const shuffleArray = (array: number[]): number[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const parseTimingMs = (t?: string) => {
    if (!t) return 5000
    const m = String(t).trim().match(/^(\d+)\s*([sm]?)$/i)
    if (!m) return 5000
    const value = Math.max(1, parseInt(m[1], 10))
    const unit = (m[2] || 's').toLowerCase()
    const ms = unit === 'm' ? value * 60_000 : value * 1_000
    return Math.max(1000, ms)
  }

  const intervalMs = parseTimingMs(effectiveSettings.timing)

  // Initial settings load
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setSettingsLoading(true)
        const serverSettings = await fetchPlayerSettings()

        setSettings(prev => ({
          ...prev,
          ...serverSettings,
        }))
      } catch (err) {
        console.error('Error loading player settings:', err)
        setSettings(DEFAULT_SETTINGS)
      } finally {
        setSettingsLoading(false)
      }
    }

    loadSettings()
  }, [])

  // Auto-refresh settings every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPlayerSettings()
          .then(serverSettings => {
            setSettings(prev => ({ ...prev, ...serverSettings }))
          })
          .catch(err => console.error('Auto-refresh failed:', err))
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const isWithinOperatingHours = useCallback(() => {
    const { startTime, endTime } = effectiveSettings

    const parseHHMM = (time: string): number => {
      const [h, m] = (time || '00:00').split(':').map(v => parseInt(v, 10) || 0)
      return h * 60 + m
    }

    const now = new Date()
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const start = parseHHMM(startTime)
    const end = parseHHMM(endTime)
    if (start <= end) {
      return nowMinutes >= start && nowMinutes < end
    } else {
      return nowMinutes >= start || nowMinutes < end
    }
  }, [effectiveSettings])

  useEffect(() => {
    const loadPhotos = async () => {
      try {
        setLoading(true)
        setError(null)

        const albumsResponse = await listAlbums({ limit: 100 })
        let activeAlbum = albumsResponse.items.find(a => a.id === effectiveSettings.activeAlbum)
        if (!activeAlbum) activeAlbum = albumsResponse.items.find(a => a.enabled)
        if (!activeAlbum) activeAlbum = albumsResponse.items.find(a => a.id === 'favorites_builtin')

        if (!activeAlbum) {
          setError('No albums available. Please create an album first.')
          return
        }

        const photosResponse = await getAlbumPhotos(activeAlbum.id, {
          limit: effectiveSettings.maxImages || 100,
        })

        if (photosResponse.items.length === 0) {
          setError(`No photos in album "${activeAlbum.name}". Try refreshing the album.`)
          return
        }

        setPhotos(photosResponse.items)
        const indices = Array.from({ length: photosResponse.items.length }, (_, i) => i)
        setShuffledIndices(shuffleArray(indices))
        setCurrentIndex(0)
      } catch (err) {
        setError('Failed to load photos from album')
        console.error('Error loading photos:', err)
      } finally {
        setLoading(false)
      }
    }

    if (!settingsLoading) {
      loadPhotos()
    }
  }, [effectiveSettings.activeAlbum, effectiveSettings.maxImages, settingsLoading])

  const getResolvedIndex = (idx: number) => {
    if (photos.length === 0) return 0
    return effectiveSettings.order === 'shuffle'
        ? shuffledIndices[idx % shuffledIndices.length]
        : idx % photos.length
  }

  const computeNextIndex = useCallback(() => {
    if (photos.length === 0) return 0
    return (currentIndex + 1) % photos.length
  }, [currentIndex, photos.length])

  const beginTransition = useCallback(() => {
    if (photos.length === 0 || isAnimating) return
    const ni = computeNextIndex()
    setNextIndex(ni)
    setIsAnimating(false)
  }, [photos.length, isAnimating, computeNextIndex])

  useEffect(() => {
    if (nextIndex == null) {
      setNextReady(false)
      return
    }
    const next = photos[getResolvedIndex(nextIndex)]
    if (!next?.url) {
      setNextReady(true)
      return
    }

    const img = new Image()
    img.decoding = 'async'
    img.src = next.url
    if (img.complete) {
      setNextReady(true)
    } else {
      const done = () => setNextReady(true)
      img.onload = done
      img.onerror = done
    }
  }, [nextIndex, photos])

  useEffect(() => {
    if (nextIndex == null || !nextReady) return

    if (effectiveSettings.transition === 'none') {
      setCurrentIndex(nextIndex)
      setNextIndex(null)
      setIsAnimating(false)
      return
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsAnimating(true)
      })
    })
  }, [nextIndex, nextReady, effectiveSettings.transition])

  const onAnimationEnd = useCallback(() => {
    if (nextIndex == null) return
    setCurrentIndex(nextIndex)
    setNextIndex(null)
    setIsAnimating(false)
  }, [nextIndex])

  useEffect(() => {
    if (!isAnimating || nextIndex == null) return
    const safety = window.setTimeout(() => {
      onAnimationEnd()
    }, TRANSITION_MS + 200)
    return () => window.clearTimeout(safety)
  }, [isAnimating, nextIndex, onAnimationEnd])

  useEffect(() => {
    if (effectiveSettings.order === 'shuffle' && photos.length > 0) {
      const indices = Array.from({ length: photos.length }, (_, i) => i)
      setShuffledIndices(shuffleArray(indices))
      setCurrentIndex(0)
    }
  }, [effectiveSettings.order, photos.length])

  useEffect(() => {
    if (photos.length === 0 || !isWithinOperatingHours()) return
    const id = window.setInterval(beginTransition, intervalMs)
    return () => window.clearInterval(id)
  }, [photos.length, isWithinOperatingHours, beginTransition, intervalMs])

  const handleRootClick = () => {
    setShowHeader(prev => !prev)
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => setShowHeader(false), 3000)
  }

  const stopPropagation: React.MouseEventHandler<HTMLDivElement> = e => e.stopPropagation()

  const goSettings = useCallback(() => {
    try {
      navigate('/settings')
    } catch {
      window.location.href = '/settings'
    }
  }, [navigate])

  const getBackgroundClasses = () => {
    const bgType = effectiveSettings.background || 'black'
    const classes = ['player-background']

    if (bgType === 'black') {
      classes.push('player-background-black')
    } else if (bgType === 'gradient') {
      classes.push('player-background-gradient')
    } else if (bgType === 'blur') {
      classes.push('player-background-blur')
    }

    return classes.join(' ')
  }

  const getBackgroundImageStyle = () => {
    if (effectiveSettings.background === 'blur') {
      const currentPhoto = photos[getResolvedIndex(currentIndex)]
      if (currentPhoto?.url) {
        return { backgroundImage: `url(${currentPhoto.url})` }
      }
    }
    return {}
  }

  const SmartImage: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
    const [panClass, setPanClass] = useState<
        'player-img-pan-horizontal' | 'player-img-pan-vertical'
    >('player-img-pan-horizontal')

    const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget
      const isPortrait = img.naturalHeight >= img.naturalWidth
      setPanClass(isPortrait ? 'player-img-pan-vertical' : 'player-img-pan-horizontal')
    }, [])

    return (
        <img
            src={src}
            alt={alt}
            className={panClass}
            draggable={false}
            decoding="async"
            onLoad={handleLoad}
        />
    )
  }

  const renderGrid = (baseIndex: number) => {
    const items = Array.from({ length: 2 }, (_, i) => photos[getResolvedIndex(baseIndex + i)])
    return (
        <div className="player-grid-2x1">
          {items.map((p, i) => (
              <div key={`${p?.id ?? 'ph'}-${i}`} className="player-cell-horizontal">
                {p && <SmartImage src={p.url} alt={p.caption || `Photo ${i + 1}`} />}
              </div>
          ))}
        </div>
    )
  }

  const renderSingle = (baseIndex: number) => {
    const photo = photos[getResolvedIndex(baseIndex)]
    if (!photo) return null

    if (effectiveSettings.layout === 'split') {
      const items = Array.from({ length: 2 }, (_, i) => photos[getResolvedIndex(baseIndex + i)])
      return (
          <div className="player-grid-split">
            {items.map((p, i) => (
                <div key={`${p?.id ?? 'ph'}-${i}`} className="player-cell-vertical">
                  {p && <SmartImage src={p.url} alt={p.caption || `Photo ${i + 1}`} />}
                </div>
            ))}
          </div>
      )
    }

    return (
        <div className="player-single-container">
          <img
              src={photo.url}
              alt={photo.caption || 'Photo'}
              className="player-single-img"
              draggable={false}
              decoding="async"
          />
        </div>
    )
  }

  const renderByLayout = (idx: number) => {
    if (effectiveSettings.layout === 'grid') return renderGrid(idx)
    return renderSingle(idx)
  }

  const outsideHours = !isWithinOperatingHours()

  if (loading || settingsLoading) {
    return (
        <div className="player-loading">
          <div className="player-loading-text">Loading photos...</div>
        </div>
    )
  }

  if (error || photos.length === 0) {
    return (
        <div className="player-error">
          <div className="player-error-text">{error || 'No photos available'}</div>
        </div>
    )
  }

  if (outsideHours) {
    return (
        <div className="player-inactive">
          <div>
            <h2 className="player-inactive-title">Display Inactive</h2>
            <p className="player-inactive-message">Outside operating hours</p>
            <p className="player-inactive-hours">
              Active from {effectiveSettings.startTime} to {effectiveSettings.endTime}
            </p>
            <button onClick={goSettings} className="player-inactive-button">
              Open Settings
            </button>
          </div>
        </div>
    )
  }

  const isFade = effectiveSettings.transition === 'fade'
  const isSlide = effectiveSettings.transition === 'slide'

  const currentLayerClass =
      isFade
          ? isAnimating
              ? 'player-transparent'
              : 'player-opaque'
          : isSlide
              ? isAnimating
                  ? direction === 'left'
                      ? 'player-translate-left player-transparent'
                      : 'player-translate-right player-transparent'
                  : 'player-translate-0 player-opaque'
              : 'player-opaque'

  const nextLayerClass =
      isFade
          ? isAnimating
              ? 'player-opaque'
              : 'player-transparent'
          : isSlide
              ? isAnimating
                  ? 'player-translate-0 player-opaque'
                  : direction === 'left'
                      ? 'player-translate-right player-transparent'
                      : 'player-translate-left player-transparent'
              : 'player-transparent'

  return (
      <div
          onClick={handleRootClick}
          role="button"
          aria-label="Toggle header"
          tabIndex={0}
          className="player-root"
          style={{ ['--player-transition-ms' as any]: `${TRANSITION_MS}ms` }}
      >
        <div className={getBackgroundClasses()} style={getBackgroundImageStyle()} />

        {effectiveSettings.background === 'blur' && (
            <div className="player-background-overlay" />
        )}

        {showHeader && (
            <div onClick={stopPropagation} className="player-header-container">
              <Header />
            </div>
        )}

        <div className={['player-layer', currentLayerClass].join(' ')}>
          {renderByLayout(currentIndex)}
        </div>

        {nextIndex != null && (
            <div
                className={['player-layer', nextLayerClass].join(' ')}
                onTransitionEnd={onAnimationEnd}
            >
              {renderByLayout(nextIndex)}
            </div>
        )}
      </div>
  )
}

export default PlayerPage
