import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const AlbumsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    // Check if we were redirected here after successful authentication
    if (searchParams.get('auth') === 'success') {
      setShowSuccess(true)
      // Remove the auth parameter from URL
      setSearchParams({})
      // Hide success message after 5 seconds
      setTimeout(() => setShowSuccess(false), 5000)
    }
  }, [searchParams, setSearchParams])
  return (
    <div>
      {showSuccess && (
        <div className="success-banner">
          <p>✅ Successfully connected to Pixelfed! You are now authenticated.</p>
        </div>
      )}
      
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
    </div>
  )
}

export default AlbumsPage
