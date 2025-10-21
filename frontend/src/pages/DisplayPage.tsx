import React, { useState, useEffect } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import { listAlbums, type Album } from '../services/albumService'

const DisplayPage: React.FC = () => {
  const { settings, updateSettings, resetSettings, isWithinOperatingHours, getTimingInMs } = useSettings()
  const [albums, setAlbums] = useState<Album[]>([])
  const [loadingAlbums, setLoadingAlbums] = useState(true)

  // Load albums on mount
  useEffect(() => {
    const fetchAlbums = async () => {
      try {
        setLoadingAlbums(true)
        const response = await listAlbums({ limit: 100 })
        setAlbums(response.items.filter(a => a.enabled))
      } catch (error) {
        console.error('Failed to load albums:', error)
      } finally {
        setLoadingAlbums(false)
      }
    }
    fetchAlbums()
  }, [])

  const handleLayoutChange = (layout: 'single' | 'grid' | 'split') => {
    updateSettings({ layout })
  }

  const handleTransitionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ transition: event.target.value as 'none' | 'fade' | 'slide' })
  }

  const handleTimingChange = (timing: '10s' | '30s' | '1m') => {
    updateSettings({ timing })
  }

  const handleOrderChange = (order: 'fixed' | 'shuffle') => {
    updateSettings({ order })
  }

  const handleTimeChange = (field: 'startTime' | 'endTime', value: string) => {
    updateSettings({ [field]: value })
  }

  const handleNumberChange = (field: 'maxImages' | 'recencyWindow', value: string) => {
    const numValue = parseInt(value) || 0
    updateSettings({ [field]: numValue })
  }

  const handleAlbumChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ activeAlbum: event.target.value })
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Display</h1>
        </div>
        <button onClick={resetSettings} className="btn btn-secondary btn-small">
          Reset
        </button>
      </div>


      <div className="display-grid">
        <div>
          {/* Layout */}
          <div className="card">
            <h2 className="card-title">Layout</h2>
            <div className="radio-group">
              {(['single', 'grid', 'split'] as const).map((layout) => (
                <label key={layout} className="radio-label">
                  <input 
                    type="radio" 
                    name="layout" 
                    value={layout}
                    checked={settings.layout === layout}
                    onChange={() => handleLayoutChange(layout)}
                    className="radio-input"
                  />
                  <span className="radio-text">
                    {layout === 'grid' ? '2×2 Grid' : layout}
                  </span>
                </label>
              ))}
            </div>
          </div>


          {/* Transition */}
          <div className="card">
            <h2 className="card-title">Transition</h2>
            <select 
              value={settings.transition}
              onChange={handleTransitionChange}
              className="form-select"
              aria-label="Select transition type"
            >
              <option value="none">None</option>
              <option value="fade">Fade</option>
              <option value="slide">Slide</option>
            </select>
          </div>


          {/* Timing */}
          <div className="card">
            <h2 className="card-title">Timing</h2>
            <div className="radio-group">
              {(['10s', '30s', '1m'] as const).map((timing) => (
                <label key={timing} className="radio-label">
                  <input 
                    type="radio" 
                    name="timing" 
                    value={timing}
                    checked={settings.timing === timing}
                    onChange={() => handleTimingChange(timing)}
                    className="radio-input"
                  />
                  <span className="radio-text">
                    {timing === '10s' ? '10 seconds' : timing === '30s' ? '30 seconds' : '1 minute'}
                  </span>
                </label>
              ))}
            </div>
          </div>


          {/* Order */}
          <div className="card">
            <h2 className="card-title">Order</h2>
            <div className="radio-group">
              {(['fixed', 'shuffle'] as const).map((order) => (
                <label key={order} className="radio-label">
                  <input 
                    type="radio" 
                    name="order" 
                    value={order}
                    checked={settings.order === order}
                    onChange={() => handleOrderChange(order)}
                    className="radio-input"
                  />
                  <span className="radio-text">{order}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Hours */}
          <div className="card">
            <h2 className="card-title">Hours of Operation</h2>
            <div className="time-inputs-grid">
              <div className="form-group">
                <label htmlFor="startTime" className="form-label">Start</label>
                <input 
                  type="time" 
                  id="startTime" 
                  value={settings.startTime}
                  onChange={(e) => handleTimeChange('startTime', e.target.value)}
                  className="form-input"
                  aria-label="Start time" 
                />
              </div>
              <div className="form-group">
                <label htmlFor="endTime" className="form-label">End</label>
                <input 
                  type="time" 
                  id="endTime" 
                  value={settings.endTime}
                  onChange={(e) => handleTimeChange('endTime', e.target.value)}
                  className="form-input"
                  aria-label="End time" 
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          {/* Active Album */}
          <div className="card">
            <h2 className="card-title">Active Album</h2>
            {loadingAlbums ? (
              <p className="form-help-text">Loading...</p>
            ) : albums.length > 0 ? (
              <select 
                value={settings.activeAlbum}
                onChange={handleAlbumChange}
                className="form-select"
                aria-label="Select active album"
              >
                {albums.map(album => (
                  <option key={album.id} value={album.id}>
                    {album.name} ({album.stats?.total || 0})
                  </option>
                ))}
              </select>
            ) : (
              <div className="empty-state-compact">
                <p className="empty-state-message">No albums</p>
                <a href="/albums" className="btn btn-primary btn-small">
                  Create Album
                </a>
              </div>
            )}
          </div>

          {/* Limits */}
          <div className="card">
            <h2 className="card-title">Limits</h2>
            <div className="form-group">
              <label htmlFor="maxImages" className="form-label">Max Images</label>
              <input 
                type="number" 
                id="maxImages" 
                value={settings.maxImages}
                onChange={(e) => handleNumberChange('maxImages', e.target.value)}
                className="form-input"
                placeholder="100" 
                aria-label="Maximum number of images" 
              />
            </div>
            <div className="form-group">
              <label htmlFor="recencyWindow" className="form-label">Recency (days)</label>
              <input 
                type="number" 
                id="recencyWindow" 
                value={settings.recencyWindow}
                onChange={(e) => handleNumberChange('recencyWindow', e.target.value)}
                className="form-input"
                placeholder="30" 
                aria-label="Recency window in days" 
              />
            </div>
          </div>


          {/* Player */}
          <div className="card">
            <h2 className="card-title">Player</h2>
            <a href="/player" className="btn btn-primary btn-full">
              Launch Player
            </a>
            <button
              onClick={() => window.open('/player', '_blank')}
              className="btn btn-secondary btn-full"
            >
              New Window
            </button>
          </div>

          {/* Status */}
          <div className="card">
            <h2 className="card-title">Status</h2>
            <div className={isWithinOperatingHours() ? 'status-badge status-active' : 'status-badge status-inactive'}>
              {isWithinOperatingHours() ? 'Active' : 'Outside Hours'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DisplayPage
