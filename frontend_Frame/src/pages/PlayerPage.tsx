import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Photo } from '../services/photoService'
import { getAlbumPhotos, listAlbums } from '../services/albumService'
import { useSettings } from '../contexts/SettingsContext'
import Header from '../components/Header'
import '../styles/player.css'  // plain-CSS , tailwind was not working with me

const PlayerPage: React.FC = () => {
  const navigate = useNavigate()
  const { settings, isWithinOperatingHours } = useSettings()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showHeader, setShowHeader] = useState(false)
  const hideTimerRef = useRef<number | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [nextIndex, setNextIndex] = useState<number | null>(null)
  const [direction] = useState<'left' | 'right'>('left') // slide-in direction , this section is still buggy with the transition
  const [nextReady, setNextReady] = useState(false)       // preload guard, helped with bugs

//shuffle func
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
    const m = String(t).trim().match(/^(\d+)\s*s?$/i) // "10s" or "10"
    return m ? Math.max(1000, parseInt(m[1], 10) * 1000) : 5000
  }
  const intervalMs = parseTimingMs(settings?.timing)

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
        setShuffledIndices(shuffleArray(indices))
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

  // issues with image indexing
  const getResolvedIndex = (idx: number) => {
    if (photos.length === 0) return 0
    return settings.order === 'shuffle'
        ? shuffledIndices[idx % shuffledIndices.length]
        : idx % photos.length
  }

  const computeNextIndex = useCallback(() => {
    if (photos.length === 0) return 0
    return (currentIndex + 1) % photos.length
  }, [currentIndex, photos.length])

  // transition cycles, preparing before hand
  const beginTransition = useCallback(() => {
    if (photos.length === 0 || isAnimating) return
    const ni = computeNextIndex()
    setNextIndex(ni)
    setIsAnimating(false)
  }, [photos.length, isAnimating, computeNextIndex])

  // Preload next image whenever nextIndex changes
  useEffect(() => {
    if (nextIndex == null) { setNextReady(false); return }
    const next = photos[getResolvedIndex(nextIndex)]
    if (!next?.url) { setNextReady(true); return }

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

  // After preload: drive animation
  useEffect(() => {
    if (nextIndex == null || !nextReady) return

    if (settings.transition === 'none') {
      // instant, fixed issues with flicking, although still some there
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
  }, [nextIndex, nextReady, settings.transition])

  //  safety fallback
  const onAnimationEnd = useCallback(() => {
    if (nextIndex == null) return
    setCurrentIndex(nextIndex)
    setNextIndex(null)
    setIsAnimating(false)
  }, [nextIndex])

  useEffect(() => {
    if (!isAnimating || nextIndex == null) return
    const safety = window.setTimeout(() => { onAnimationEnd() }, 1600) // > CSS duration
    return () => window.clearTimeout(safety)
  }, [isAnimating, nextIndex, onAnimationEnd])

  // Re-shuffle
  useEffect(() => {
    if (settings.order === 'shuffle' && photos.length > 0) {
      const indices = Array.from({ length: photos.length }, (_, i) => i)
      setShuffledIndices(shuffleArray(indices))
      setCurrentIndex(0)
    }
  }, [settings.order, photos.length])

  //  timer
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
    try { navigate('/settings') } catch { window.location.href = '/settings' }
  }, [navigate])

  //grid that always fits the screen
  const renderGrid = (baseIndex: number) => {
    const items = Array.from({ length: 4 }, (_, i) => photos[getResolvedIndex(baseIndex + i)])
    return (
        <div className="player-grid">
          {items.map((p, i) => (
              <div key={`${p?.id ?? 'ph'}-${i}`} className="player-cell">
                {p && (
                    <img
                        src={p.url}
                        alt={p.caption || `Photo ${i + 1}`}
                        className="player-img"
                        draggable={false}
                        decoding="async"
                    />
                )}
              </div>
          ))}
        </div>
    )
  }

  // Single image centered
  const fixedImageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    backgroundColor: 'black',
    display: 'block',
    borderRadius: 12,
    boxShadow: '0 10px 30px rgba(0,0,0,.5)'
  }
  const renderSingle = (baseIndex: number) => {
    const photo = photos[getResolvedIndex(baseIndex)]
    if (!photo) return null
    return (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img
              src={photo.url}
              alt={photo.caption || 'Photo'}
              style={fixedImageStyle}
              draggable={false}
              decoding="async"
          />
        </div>
    )
  }

  const renderByLayout = (idx: number) => {
    if (settings.layout === 'grid') return renderGrid(idx) // 2×2
    return renderSingle(idx)                                // single
  }

  const outsideHours = !isWithinOperatingHours()

  if (loading) {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'black', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 18 }}>Loading photos...</div>
        </div>
    )
  }

  if (error || photos.length === 0) {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'black', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 18 }}>{error || 'No photos available'}</div>
        </div>
    )
  }

  if (outsideHours) {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'black', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Display Inactive</h2>
            <p style={{ fontSize: 18, marginBottom: 6 }}>Outside operating hours</p>
            <p style={{ fontSize: 16, opacity: 0.75 }}>
              Active from {settings.startTime} to {settings.endTime}
            </p>
            <button
                onClick={goSettings}
                style={{
                  marginTop: 24, padding: '12px 20px', background: 'rgba(255,255,255,.1)',
                  borderRadius: 10, color: 'white', border: 'none', cursor: 'pointer'
                }}
            >
              Open Settings
            </button>
          </div>
        </div>
    )
  }
  const isFade = settings.transition === 'fade'
  const isSlide = settings.transition === 'slide'

  const currentLayerClass =
      isFade
          ? (isAnimating ? 'player-transparent' : 'player-opaque')
          : isSlide
              ? (isAnimating
                  ? (direction === 'left'
                      ? 'player-translate-left player-transparent'
                      : 'player-translate-right player-transparent')
                  : 'player-translate-0 player-opaque')
              : 'player-opaque'

  const nextLayerClass =
      isFade
          ? (isAnimating ? 'player-opaque' : 'player-transparent')
          : isSlide
              ? (isAnimating
                  ? 'player-translate-0 player-opaque'
                  : (direction === 'left'
                      ? 'player-translate-right player-transparent'
                      : 'player-translate-left player-transparent'))
              : 'player-transparent'

  return (
      <div
          onClick={handleRootClick}
          role="button"
          aria-label="Toggle header"
          tabIndex={0}
          style={{ position: 'fixed', inset: 0, background: 'black', overflow: 'hidden' }}
      >
        {showHeader && (
            <div
                onClick={stopPropagation}
                style={{
                  position: 'absolute',
                  left: 0, right: 0, top: 0,
                  zIndex: 50,
                  background: 'rgba(0,0,0,0.7)',
                  backdropFilter: 'blur(6px)'
                }}
            >
              <Header />
            </div>
        )}

        <div className={['player-layer', currentLayerClass].join(' ')}>
          {renderByLayout(currentIndex)}
        </div>

        {nextIndex != null && (
            <div className={['player-layer', nextLayerClass].join(' ')} onTransitionEnd={onAnimationEnd}>
              {renderByLayout(nextIndex)}
            </div>
        )}
      </div>
  )
}

export default PlayerPage
