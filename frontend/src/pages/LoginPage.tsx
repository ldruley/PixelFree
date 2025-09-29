import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const LoginPage: React.FC = () => {
  const { authStatus, isLoading, login } = useAuth()
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  // Redirect if already authenticated
  useEffect(() => {
    if (authStatus.isAuthenticated) {
      navigate('/albums')
    }
  }, [authStatus.isAuthenticated, navigate])

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true)
      setError(null)
      await login()
      // Note: login() will redirect to Pixelfed, so we won't reach this point
      // unless there's an error
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
      setIsLoggingIn(false)
    }
  }

  if (isLoading) {
    return (
      <div>
        <div>
          <p>Checking authentication status...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div>
        <h1>
          Connect to PixelFree
        </h1>
        
        <div>
          <p>
            PixelFree connects to your Pixelfed account to display your photos.
            Click the button below to sign in with Pixelfed.
          </p>
          
          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? 'Connecting...' : 'Connect to Pixelfed'}
          </button>
          
          {error && (
            <div>
              <p className="error-message">
                {error}
              </p>
            </div>
          )}
          
          <div>
            <p>
              <small>
                You'll be redirected to Pixelfed to authorize PixelFree.
                After authorization, you'll return here automatically.
              </small>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
