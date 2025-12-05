import React, { useState, useEffect } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import { listAlbums, type Album } from '../services/albumService'
import { loadAllPages } from '../utils/helpers'
import { updatePlayerSettings } from '../services/settingsService.ts'  // NEW

const DisplayPage: React.FC = () => {
  const { settings, updateSettings, resetSettings, isWithinOperatingHours } = useSettings()
  const [albums, setAlbums] = useState<Album[]>([])
  const [loadingAlbums, setLoadingAlbums] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Load albums on mount
  useEffect(() => {
    const fetchAlbums = async () => {
      try {
        setLoadingAlbums(true)

        // Fetch all albums using helper (no limit on albums)
        const allAlbums = await loadAllPages<Album>(listAlbums)

        setAlbums(allAlbums.filter(a => a.enabled))
      } catch (error) {
        console.error('Failed to load albums:', error)
      } finally {
        setLoadingAlbums(false)
      }
    }
    fetchAlbums()
  }, [])
  const handleBackgroundChange = (background: 'black' | 'blur' | 'gradient') => {
    updateSettings({ background })
  }
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

  const handleSaveSettingsToApi = async () => {
    try {
      setSavingSettings(true)
      setSaveError(null)
      setSaveSuccess(false)

      await updatePlayerSettings(settings)

      setSaveSuccess(true)
    } catch (error) {
      console.error('Failed to save settings to API:', error)
      setSaveError(
          error instanceof Error ? error.message : 'Failed to save settings'
      )
    } finally {
      setSavingSettings(false)
    }
  }

  return (
      <div className="app-content">
        <div className="page-header-actions">
          <h1 className="app-page-title">Display Settings</h1>

          <div className="displaypage-actions">
            <button
                onClick={handleSaveSettingsToApi}
                className="action-btn display-save"
                disabled={savingSettings}
            >
              {savingSettings ? 'Saving…' : 'Save'}
            </button>

            <button onClick={resetSettings} className="action-btn">
              Reset
            </button>
          </div>
        </div>

        {(saveError || saveSuccess) && (
            <div className="display-save-status">
              {saveError && <span className="text-error">{saveError}</span>}
              {saveSuccess && !saveError && (
                  <span className="text-success">Settings saved to server.</span>
              )}
            </div>
        )}

        <div className="display-page-grid">
          <div>
            <div className="display-card">
              <h2 className="display-card-title">Background</h2>
              <div className="display-radio-group">
                {(['black', 'blur', 'gradient'] as const).map((bg) => (
                    <label key={bg} className="display-radio-label">
                      <input
                          type="radio"
                          name="background"
                          value={bg}
                          checked={settings.background === bg}
                          onChange={() => handleBackgroundChange(bg)}
                          className="display-radio-input"
                      />
                      <span className="text-capitalize">
          {bg === 'black' ? 'Black' : bg === 'blur' ? 'Blur' : 'Gradient'}
        </span>
                    </label>
                ))}
              </div>
            </div>
            {/* Layout */}
            <div className="display-card">
              <h2 className="display-card-title">Layout</h2>
              <div className="display-radio-group">
                {(['single', 'grid', 'split'] as const).map((layout) => (
                    <label key={layout} className="display-radio-label">
                      <input
                          type="radio"
                          name="layout"
                          value={layout}
                          checked={settings.layout === layout}
                          onChange={() => handleLayoutChange(layout)}
                          className="display-radio-input"
                      />
                      <span className="text-capitalize">
                    {layout === 'grid' ? 'H Split' : layout}
                  </span>
                    </label>
                ))}
              </div>
            </div>

            {/* Transition */}
            <div className="display-card">
              <h2 className="display-card-title">Transition</h2>
              <select
                  value={settings.transition}
                  onChange={handleTransitionChange}
                  className="display-select"
                  aria-label="Select transition type"
              >
                <option value="none">None</option>
                <option value="fade">Fade</option>
                <option value="slide">Slide</option>
              </select>
            </div>

            {/* Timing */}
            <div className="display-card">
              <h2 className="display-card-title">Timing</h2>
              <div className="display-radio-group">
                {(['10s', '30s', '1m'] as const).map((timing) => (
                    <label key={timing} className="display-radio-label">
                      <input
                          type="radio"
                          name="timing"
                          value={timing}
                          checked={settings.timing === timing}
                          onChange={() => handleTimingChange(timing)}
                          className="display-radio-input"
                      />
                      <span>
                    {timing === '10s' ? '10s' : timing === '30s' ? '30s' : '1m'}
                  </span>
                    </label>
                ))}
              </div>
            </div>

            {/* Order */}
            <div className="display-card">
              <h2 className="display-card-title">Order</h2>
              <div className="display-radio-group">
                {(['fixed', 'shuffle'] as const).map((order) => (
                    <label key={order} className="display-radio-label">
                      <input
                          type="radio"
                          name="order"
                          value={order}
                          checked={settings.order === order}
                          onChange={() => handleOrderChange(order)}
                          className="display-radio-input"
                      />
                      <span className="text-capitalize">{order}</span>
                    </label>
                ))}
              </div>
            </div>

            {/* Hours */}
            <div className="display-card">
              <h2 className="display-card-title">Hours of Operation</h2>
              <div className="display-time-grid">
                <div className="display-form-group">
                  <label htmlFor="startTime" className="display-form-label">Start</label>
                  <input
                      type="time"
                      id="startTime"
                      value={settings.startTime}
                      onChange={(e) => handleTimeChange('startTime', e.target.value)}
                      className="display-input"
                      aria-label="Start time"
                  />
                </div>
                <div className="display-form-group">
                  <label htmlFor="endTime" className="display-form-label">End</label>
                  <input
                      type="time"
                      id="endTime"
                      value={settings.endTime}
                      onChange={(e) => handleTimeChange('endTime', e.target.value)}
                      className="display-input"
                      aria-label="End time"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            {/* Active Album */}
            <div className="display-card">
              <h2 className="display-card-title">Active Album</h2>
              {loadingAlbums ? (
                  <p className="loading-text">Loading...</p>
              ) : albums.length > 0 ? (
                  <select
                      value={settings.activeAlbum}
                      onChange={handleAlbumChange}
                      className="display-select"
                      aria-label="Select active album"
                  >
                    {albums.map(album => (
                        <option key={album.id} value={album.id}>
                          {album.name} ({album.stats?.total || 0})
                        </option>
                    ))}
                  </select>
              ) : (
                  <div className="display-empty-state">
                    <p className="display-empty-message">No albums</p>
                    <a href="/albums" className="display-btn-primary action-btn-inline">
                      Create Album
                    </a>
                  </div>
              )}
            </div>

            {/* Limits */}
            <div className="display-card">
              <h2 className="display-card-title">Limits</h2>
              <div className="display-form-group">
                <label htmlFor="maxImages" className="display-form-label">Max Images</label>
                <input
                    type="number"
                    id="maxImages"
                    value={settings.maxImages}
                    onChange={(e) => handleNumberChange('maxImages', e.target.value)}
                    className="display-input"
                    placeholder="100"
                    aria-label="Maximum number of images"
                />
              </div>
              <div className="display-form-group">
                <label htmlFor="recencyWindow" className="display-form-label">Recency (days)</label>
                <input
                    type="number"
                    id="recencyWindow"
                    value={settings.recencyWindow}
                    onChange={(e) => handleNumberChange('recencyWindow', e.target.value)}
                    className="display-input"
                    placeholder="30"
                    aria-label="Recency window in days"
                />
              </div>
            </div>

            {/* Player */}
            <div className="display-card">
              <h2 className="display-card-title">Player</h2>
              <div className="display-button-group">
                <a href="/player" className="display-btn-primary">
                  Launch Player
                </a>
                <button
                    onClick={() => window.open('/player', '_blank')}
                    className="display-btn-secondary"
                >
                  New Window
                </button>
              </div>
            </div>

            {/* Status */}
            <div className="display-card">
              <h2 className="display-card-title">Status</h2>
              <div
                  className={`display-status-badge ${isWithinOperatingHours() ? 'display-status-active' : 'display-status-inactive'}`}
              >
                {isWithinOperatingHours() ? 'Active' : 'Outside Hours'}
              </div>
            </div>
          </div>
        </div>
      </div>
  )
}

export default DisplayPage
