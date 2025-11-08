import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import Header from './components/Header'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import SettingsPage from './pages/SettingsPage'
import PlayerPage from './pages/PlayerPage'

function App() {
  return (
      <AuthProvider>
        <SettingsProvider>
          <Router>
            <Routes>
              <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <PlayerPage />
                    </ProtectedRoute>
                  }
              />

              <Route
                  path="/*"
                  element={
                    <div>
                      <Header />
                      <main>
                        <Routes>
                          <Route path="/login" element={<LoginPage />} />
                          <Route
                              path="/settings"
                              element={
                                <ProtectedRoute>
                                  <SettingsPage />
                                </ProtectedRoute>
                              }
                          />
                        </Routes>
                      </main>
                    </div>
                  }
              />
            </Routes>
          </Router>
        </SettingsProvider>
      </AuthProvider>
  )
}

export default App
