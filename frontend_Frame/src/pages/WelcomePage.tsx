import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import '../styles/player.css'

const WelcomePage: React.FC = () => {
    const navigate = useNavigate()
    useEffect(() => {
        const timer = setTimeout(() => {
            navigate('/player')
        }, 3000)

        return () => clearTimeout(timer)
    }, [navigate])

    return (
        <>
            <div className="auth-background" />
        <div className="page-container ">
            <Header />

            <div className="welcome-content">
                <div className="welcome-logo-group">
                    <h1 className="welcome-title">Welcome to</h1>
                    <img
                        className="welcome-image"
                        src="/pixelfree-logo.svg"
                        alt="PixelFree"
                    />
                </div>
                <p className="welcome-subtitle">Loading your photo display…</p>
            </div>

        </div>
            </>
    )
}

export default WelcomePage
