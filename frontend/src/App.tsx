import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Header from './components/Header'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import AlbumsPage from './pages/AlbumsPage'
import DisplayPage from './pages/DisplayPage'
import PlayerPage from './pages/PlayerPage'

function App() {
  return (
    <AuthProvider>
      <Router>
        <div>
          <Header />
          <main>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route 
                path="/albums" 
                element={
                  <ProtectedRoute>
                    <AlbumsPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/display" 
                element={
                  <ProtectedRoute>
                    <DisplayPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/player" 
                element={
                  <ProtectedRoute>
                    <PlayerPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <AlbumsPage />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App
