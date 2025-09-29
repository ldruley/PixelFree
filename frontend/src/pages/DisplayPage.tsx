import React from 'react'

const DisplayPage: React.FC = () => {
  return (
    <div>
      <div>
        <h1>Display Settings</h1>
        
        <div>
          {/* Layout Options */}
          <div>
            <h2>Layout Options</h2>
            <div>
              <label>
                <input type="radio" name="layout" value="single" defaultChecked />
                <span>Single</span>
              </label>
              <label>
                <input type="radio" name="layout" value="grid" />
                <span>2×2 Grid</span>
              </label>
              <label>
                <input type="radio" name="layout" value="split" />
                <span>Split</span>
              </label>
            </div>
          </div>
          
          {/* Transition Options */}
          <div>
            <h2>Transition</h2>
            <select aria-label="Select transition type">
              <option value="none">None</option>
              <option value="fade">Fade</option>
              <option value="slide">Slide</option>
            </select>
          </div>
          
          {/* Timing Control */}
          <div>
            <h2>Change Every</h2>
            <div>
              <label>
                <input type="radio" name="timing" value="10s" defaultChecked />
                <span>10 seconds</span>
              </label>
              <label>
                <input type="radio" name="timing" value="30s" />
                <span>30 seconds</span>
              </label>
              <label>
                <input type="radio" name="timing" value="1m" />
                <span>1 minute</span>
              </label>
            </div>
          </div>
          
          {/* Order Toggle */}
          <div>
            <h2>Order</h2>
            <div>
              <label>
                <input type="radio" name="order" value="fixed" defaultChecked />
                <span>Fixed</span>
              </label>
              <label>
                <input type="radio" name="order" value="shuffle" />
                <span>Shuffle</span>
              </label>
            </div>
          </div>
          
          {/* Hours of Operation */}
          <div>
            <h2>Hours of Operation</h2>
            <div>
              <div>
                <label htmlFor="startTime">Start</label>
                <input type="time" id="startTime" defaultValue="08:00" aria-label="Start time" />
              </div>
              <div>
                <label htmlFor="endTime">End</label>
                <input type="time" id="endTime" defaultValue="22:00" aria-label="End time" />
              </div>
            </div>
          </div>
          
          {/* Limits */}
          <div>
            <h2>Limits</h2>
            <div>
              <div>
                <label htmlFor="maxImages">Max Images</label>
                <input type="number" id="maxImages" placeholder="100" aria-label="Maximum number of images" />
              </div>
              <div>
                <label htmlFor="recencyWindow">Recency Window (days)</label>
                <input type="number" id="recencyWindow" placeholder="30" aria-label="Recency window in days" />
              </div>
            </div>
          </div>
          
          {/* Active Album */}
          <div>
            <h2>Active Album</h2>
            <select aria-label="Select active album">
              <option value="favorites">Favorites</option>
              <option value="sample">Sample Album</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Live Preview */}
      <div>
        <h2>Live Preview</h2>
        <div>
          <p>Preview will appear here</p>
          <p>Changes update instantly</p>
        </div>
      </div>
    </div>
  )
}

export default DisplayPage
