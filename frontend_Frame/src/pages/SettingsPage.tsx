import { useSettings } from '../contexts/SettingsContext'

const SettingsPage: React.FC = () => {
  const { settings, updateSettings, resetSettings, isWithinOperatingHours } = useSettings()
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
                    {layout === 'grid' ? '2×1 Grid' : layout}
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
            {/* Background */}
            <div className="card">
              <h2 className="card-title">Background</h2>
              <div className="radio-group">
                {(['black', 'blur', 'gradient'] as const).map((bg) => (
                    <label key={bg} className="radio-label">
                      <input
                          type="radio"
                          name="background"
                          value={bg}
                          checked={settings.background === bg}
                          onChange={() => updateSettings({ background: bg })}
                          className="radio-input"
                      />
                      <span className="radio-text">
          {bg === 'black' ? 'Black' : bg === 'blur' ? 'Blurred Image' : 'Sky Gradient'}
        </span>
                    </label>
                ))}
              </div>
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

export default SettingsPage
