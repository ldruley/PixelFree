import React from 'react'
import type { ReactElement } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: ReactElement
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { authStatus, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div>
        <div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!authStatus.isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute
