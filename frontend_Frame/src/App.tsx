import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import Header from './components/Header'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DisplayPage from './pages/DisplayPage'
import PlayerPage from './pages/PlayerPage'

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
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
            
            {/* All other routes with header */}
            <Route path="/*" element={
              <div>
                <Header />
                <main>
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route 
                      path="/display" 
                      element={
                        <ProtectedRoute>
                          <DisplayPage />
                        </ProtectedRoute>
                      } 
                    />
                  </Routes>
                </main>
              </div>
            } />
          </Routes>
        </Router>
      </SettingsProvider>
    </AuthProvider>
  )
}

export default App
