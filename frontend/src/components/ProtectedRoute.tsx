import React from 'react'
import type { ReactElement } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Loading from './Loading'

interface ProtectedRouteProps {
  children: ReactElement
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { authStatus, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="app-content">
        <Loading message="Checking authentication..." />
      </div>
    )
  }

  if (!authStatus.isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute
