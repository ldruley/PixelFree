import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const WelcomePage: React.FC = () => {
    const navigate = useNavigate()

    useEffect(() => {
        // stay for 3 seconds then go to player
        const timer = setTimeout(() => {
            navigate('/')
        }, 5000)
        return () => clearTimeout(timer)
    }, [navigate])

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'black',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'sans-serif',
            }}
        >
            <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>Welcome</h1>
            <p style={{ fontSize: '1.5rem', opacity: 0.8 }}>
                Loading your photo display...
            </p>
        </div>
    )
}

export default WelcomePage
