import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import ProtectedRoute from './components/ProtectedRoute'
import SharedLayout from './components/SharedLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import AlbumsPage from './pages/AlbumsPage'
import AlbumGalleryPage from './pages/AlbumGalleryPage'
import FavoritesPage from './pages/FavoritesPage'
import DisplayPage from './pages/DisplayPage'
import PlayerPage from './pages/PlayerPage'

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Toaster />
        <Router>
          <Routes>
            {/* Full-screen player route without header */}
            <Route 
              path="/player" 
              element={
                <ProtectedRoute>
                  <PlayerPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Main App Routes with Shared Layout */}
            <Route element={<ProtectedRoute><SharedLayout /></ProtectedRoute>}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/albums" element={<AlbumsPage />} />
              <Route path="/albums/:id" element={<AlbumGalleryPage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/display" element={<DisplayPage />} />
            </Route>
            
            {/* Login Route */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Fallback for any unmatched routes */}
            <Route path="*" element={<LoginPage />} />
          </Routes>
        </Router>
      </SettingsProvider>
    </AuthProvider>
  )
}

export default App
