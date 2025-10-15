import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const Header: React.FC = () => {
  const { authStatus, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)
      await logout()
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="app-header">
      <nav className="navbar">
        <div className="navbar-brand">
          <Link to="/" className="brand-link">
            PixelFree
          </Link>
        </div>
        
        <div className="navbar-menu">
          {authStatus.isAuthenticated ? (
            <>
              <Link 
                to="/albums" 
                className={`nav-link ${isActive('/albums') ? 'active' : ''}`}
              >
                Albums
              </Link>
              <Link 
                to="/display" 
                className={`nav-link ${isActive('/display') ? 'active' : ''}`}
              >
                Display
              </Link>
              <Link 
                to="/player" 
                className={`nav-link ${isActive('/player') ? 'active' : ''}`}
              >
                Player
              </Link>
              {authStatus.user?.display_name && (
                <span className="user-name">
                  {authStatus.user.display_name}
                </span>
              )}
              <button 
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="btn btn-secondary btn-small"
              >
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary">
              Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}

export default Header
