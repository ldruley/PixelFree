import React from 'react'
import { useSettings } from '../contexts/SettingsContext'

const DisplayPage: React.FC = () => {
  const { settings, updateSettings, resetSettings, isWithinOperatingHours, getTimingInMs } = useSettings()

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
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Display Settings</h1>
          <div className="flex space-x-4">
            <button
              onClick={resetSettings}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Reset to Defaults
            </button>
            <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
              isWithinOperatingHours() 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {isWithinOperatingHours() ? 'Active' : 'Outside Hours'}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Layout Options */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Layout Options</h2>
              <div className="space-y-3">
                {(['single', 'grid', 'split'] as const).map((layout) => (
                  <label key={layout} className="flex items-center space-x-3 cursor-pointer">
                    <input 
                      type="radio" 
                      name="layout" 
                      value={layout}
                      checked={settings.layout === layout}
                      onChange={() => handleLayoutChange(layout)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 capitalize">
                      {layout === 'grid' ? '2×2 Grid' : layout}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            
            {/* Transition Options */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Transition Effect</h2>
              <select 
                value={settings.transition}
                onChange={handleTransitionChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Select transition type"
              >
                <option value="none">None</option>
                <option value="fade">Fade</option>
                <option value="slide">Slide</option>
              </select>
            </div>
            
            {/* Timing Control */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Change Every ({getTimingInMs() / 1000}s)
              </h2>
              <div className="space-y-3">
                {(['10s', '30s', '1m'] as const).map((timing) => (
                  <label key={timing} className="flex items-center space-x-3 cursor-pointer">
                    <input 
                      type="radio" 
                      name="timing" 
                      value={timing}
                      checked={settings.timing === timing}
                      onChange={() => handleTimingChange(timing)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700">
                      {timing === '10s' ? '10 seconds' : timing === '30s' ? '30 seconds' : '1 minute'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            
            {/* Order Toggle */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Photo Order</h2>
              <div className="space-y-3">
                {(['fixed', 'shuffle'] as const).map((order) => (
                  <label key={order} className="flex items-center space-x-3 cursor-pointer">
                    <input 
                      type="radio" 
                      name="order" 
                      value={order}
                      checked={settings.order === order}
                      onChange={() => handleOrderChange(order)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 capitalize">{order}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Live Preview */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Live Preview</h2>
              <div className="relative">
                <iframe
                  src="/player"
                  className="w-full h-64 border border-gray-300 rounded-lg scale-75 origin-top-left"
                  title="Player Preview"
                />
                <div className="absolute inset-0 pointer-events-none bg-transparent"></div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Changes update automatically in the preview
              </p>
            </div>

            {/* Hours of Operation */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Hours of Operation</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time
                  </label>
                  <input 
                    type="time" 
                    id="startTime" 
                    value={settings.startTime}
                    onChange={(e) => handleTimeChange('startTime', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Start time" 
                  />
                </div>
                <div>
                  <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-2">
                    End Time
                  </label>
                  <input 
                    type="time" 
                    id="endTime" 
                    value={settings.endTime}
                    onChange={(e) => handleTimeChange('endTime', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="End time" 
                  />
                </div>
              </div>
            </div>
            
            {/* Limits */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Photo Limits</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="maxImages" className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Images
                  </label>
                  <input 
                    type="number" 
                    id="maxImages" 
                    value={settings.maxImages}
                    onChange={(e) => handleNumberChange('maxImages', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="100" 
                    aria-label="Maximum number of images" 
                  />
                </div>
                <div>
                  <label htmlFor="recencyWindow" className="block text-sm font-medium text-gray-700 mb-2">
                    Recency Window (days)
                  </label>
                  <input 
                    type="number" 
                    id="recencyWindow" 
                    value={settings.recencyWindow}
                    onChange={(e) => handleNumberChange('recencyWindow', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="30" 
                    aria-label="Recency window in days" 
                  />
                </div>
              </div>
            </div>
            
            {/* Active Album */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Album</h2>
              <select 
                value={settings.activeAlbum}
                onChange={handleAlbumChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Select active album"
              >
                <option value="favorites">Favorites</option>
                <option value="sample">Sample Album</option>
                <option value="recent">Recent Photos</option>
              </select>
            </div>

            {/* Quick Actions */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <a
                  href="/player"
                  className="block w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-center rounded-lg transition-colors font-medium"
                >
                  Launch Player
                </a>
                <button
                  onClick={() => window.open('/player', '_blank')}
                  className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium"
                >
                  Open Player in New Window
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Settings Summary */}
        <div className="mt-8 bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Settings Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-600">Layout:</span>
              <span className="ml-2 text-gray-900 capitalize">{settings.layout}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Timing:</span>
              <span className="ml-2 text-gray-900">{getTimingInMs() / 1000}s</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Order:</span>
              <span className="ml-2 text-gray-900 capitalize">{settings.order}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Transition:</span>
              <span className="ml-2 text-gray-900 capitalize">{settings.transition}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DisplayPage
