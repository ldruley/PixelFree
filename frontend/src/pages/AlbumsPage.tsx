import React, { useState, useEffect } from 'react'
import { getSamplePhotos } from '../services/photoService'
import type { Photo } from '../services/photoService'

const AlbumsPage: React.FC = () => {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch sample photos on component mount
  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const samplePhotos = await getSamplePhotos()
        setPhotos(samplePhotos)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load photos')
        console.error('Error fetching photos:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPhotos()
  }, [])
  return (
    <div>
      <div>
        <h1>Album Management</h1>
        <button>
          Create New Album
        </button>
      </div>
      
      <div>
        {/* Album Cards Placeholder */}
        <div>
          <h3>Favorites</h3>
          <p>Built-in album for favorite photos</p>
          <div>
            <button>
              Edit
            </button>
            <button>
              Delete
            </button>
          </div>
        </div>
        
        <div>
          <h3>Sample Album</h3>
          <p>Tags: family, vacation</p>
          <p>Users: @john@example.com</p>
          <div>
            <button>
              Edit
            </button>
            <button>
              Delete
            </button>
          </div>
        </div>
      </div>
      
      {/* Create/Edit Form Placeholder */}
      <div>
        <h2>Create New Album</h2>
        <form>
          <div>
            <label>
              Album Name
            </label>
            <input
              type="text"
              placeholder="Enter album name"
            />
          </div>
          
          <div>
            <label>
              Tags (comma separated)
            </label>
            <input
              type="text"
              placeholder="family, vacation, pets"
            />
          </div>
          
          <div>
            <label>
              Users (@user@server)
            </label>
            <input
              type="text"
              placeholder="@john@example.com, @jane@example.com"
            />
          </div>
          
          <button type="submit">
            Save Album
          </button>
        </form>
      </div>
      
      {/* Photo Grid Section */}
      <div>
        <h2>Testing Photo Call Here </h2>
        
        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}
        
        {isLoading ? (
          <div>
            <p>Loading photos...</p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
            gap: '16px',
            marginTop: '16px'
          }}>
            {photos.length > 0 ? (
              photos.map((photo) => (
                <div key={photo.id} style={{
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: '#f9f9f9'
                }}>
                  <img 
                    src={photo.preview_url || photo.url} 
                    alt={photo.caption || 'Photo'}
                    style={{
                      width: '100%',
                      height: '150px',
                      objectFit: 'cover'
                    }}
                    loading="lazy"
                  />
                  <div style={{ padding: '8px' }}>
                    <p style={{ 
                      margin: '0', 
                      fontSize: '12px', 
                      color: '#666',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {photo.author_display_name || photo.author?.username || 'Unknown'}
                    </p>
                    {photo.tags && photo.tags.length > 0 && (
                      <p style={{ 
                        margin: '4px 0 0 0', 
                        fontSize: '10px', 
                        color: '#999'
                      }}>
                        #{photo.tags.slice(0, 3).join(' #')}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p>No photos found. Try authenticating with Pixelfed first.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default AlbumsPage
