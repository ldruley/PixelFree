import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const Header: React.FC = () => {
  const location = useLocation()
  const { authStatus, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const isActive = (path: string) => {
    return location.pathname === path
  }

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
    <header>
      <div>
        <div>
          <div>
            <h1>
              PixelFree
            </h1>
          </div>
          
          <nav>
            {authStatus.isAuthenticated ? (
              <>
                <Link to="/albums">
                  Albums
                </Link>
                <Link to="/display">
                  Display
                </Link>
                <Link to="/player">
                  Player
                </Link>
              </>
            ) : null}
          </nav>

          <div>
            {authStatus.isAuthenticated ? (
              <div>
                {authStatus.user?.display_name && (
                  <span>
                    {authStatus.user.display_name}
                  </span>
                )}
                <button 
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </button>
              </div>
            ) : (
              <Link to="/login">
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
