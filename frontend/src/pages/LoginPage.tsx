import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { showError } from '../utils/toast'
import '../styles/AppLayout.css'

const LoginPage: React.FC = () => {
  const { authStatus, isLoading, login, refreshAuthStatus } = useAuth()
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Check for authentication success parameter
  useEffect(() => {
    const handleAuthSuccess = async () => {
      if (searchParams.get('auth') === 'success') {
        setShowSuccess(true)
        setSearchParams({})
        
        await refreshAuthStatus(false)
        
        setTimeout(() => {
          setShowSuccess(false)
          navigate('/albums', { replace: true })
        }, 1500)
      }
    }
    
    handleAuthSuccess()
  }, [])

  // Redirect if already authenticated (but not if showing success message)
  useEffect(() => {
    if (authStatus.isAuthenticated && !showSuccess) {
      navigate('/albums', { replace: true })
    }
  }, [authStatus.isAuthenticated, navigate, showSuccess])

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true)
      await login()
      // Note: login() will redirect to Pixelfed, so we won't reach this point
      // unless there's an error
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Login failed. Please try again.')
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
