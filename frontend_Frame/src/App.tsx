import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import PlayerPage from './pages/PlayerPage'
import WelcomePage from './pages/WelcomePage'

function App() {
    return (
        <AuthProvider>
                <Router>
                    <Routes>
                        <Route path="/welcome" element={<WelcomePage />} />
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

                                    <main>
                                        <Routes>
                                            <Route path="/login" element={<LoginPage />} />

                                        </Routes>
                                    </main>
                                </div>
                            }
                        />
                    </Routes>
                </Router>

        </AuthProvider>
    )
}

export default App
