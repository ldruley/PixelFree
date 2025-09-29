import React from 'react'

const PlayerPage: React.FC = () => {
  return (
    <div>
      <div>
        <div>
          <h1>PixelFree Player</h1>
          <p>Fullscreen photo display</p>
          
          {/* Placeholder for photo display */}
          <div>
            <div>
              Photo will appear here
            </div>
          </div>
          
          {/* Overlay controls placeholder */}
          <div>
            <div>
              Album: Favorites
            </div>
            <div>
              Photo 1 of 50
            </div>
            
            <div>
              <button>
                Previous
              </button>
              <button>
                Play/Pause
              </button>
              <button>
                Next
              </button>
            </div>
            
            <div>
              <button>
                Shuffle: Off
              </button>
            </div>
          </div>
          
          <div>
            <p>Query params: autoplay=1, controls=1, bezel=0</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PlayerPage
