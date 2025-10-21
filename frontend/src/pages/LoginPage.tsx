import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const LoginPage: React.FC = () => {
  const { authStatus, isLoading, login } = useAuth()
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Check for authentication success parameter
  useEffect(() => {
    if (searchParams.get('auth') === 'success') {
      setShowSuccess(true)
      // Remove the auth parameter from URL
      setSearchParams({})
      // Hide success message after 5 seconds, then redirect
      setTimeout(() => {
        setShowSuccess(false)
        if (authStatus.isAuthenticated) {
          navigate('/albums')
        }
      }, 5000)
    }
  }, [searchParams, setSearchParams, authStatus.isAuthenticated, navigate])

  // Redirect if already authenticated (but not if showing success message - this will take user to album for more guided flow  )
  useEffect(() => {
    if (authStatus.isAuthenticated && !showSuccess) {
      navigate('/albums')
    }
  }, [authStatus.isAuthenticated, navigate, showSuccess])

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
      <div className="page-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Checking authentication status...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      {showSuccess && (
        <div className="success-banner">
          <p className="success-banner-title">
            Successfully connected to Pixelfed! You are now authenticated.
          </p>
          <p className="success-banner-message">
            Redirecting to albums in a few seconds...
          </p>
        </div>
      )}
      
      <div className="card centered-card">
        <h1 className="page-title centered-title">
          Connect to PixelFree
        </h1>
        
        <div className="card-body">
          <p className="centered-text">
            PixelFree connects to your Pixelfed account to display your photos.
            Click the button below to sign in with Pixelfed.
          </p>
          
          <button 
            className="btn btn-primary btn-large btn-full"
            onClick={handleLogin}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? 'Connecting...' : 'Connect to Pixelfed'}
          </button>
          
          {error && (
            <div className="form-error">
              {error}
            </div>
          )}
          
          <p className="form-help-text help-text-centered">
            You'll be redirected to Pixelfed to authorize PixelFree.
            After authorization, you'll return here automatically.
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
