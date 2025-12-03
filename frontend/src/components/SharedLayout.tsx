import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FiHome, FiImage, FiHeart, FiMonitor, FiLogOut } from 'react-icons/fi';
import { showError } from '../utils/toast';
import '../styles/AppLayout.css';

const SharedLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authStatus, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Helper to determine active state
  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  const handleLogout = async () => {
    try {
      await logout();
      setShowProfileMenu(false);
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      showError('Failed to logout. Please try again.');
    }
  };

  return (
    <div className="app-container">
      {/* Gradient Header */}
      <div className="app-header-bg" />
      
      {/* Large Profile Avatar (Left) - Only on Dashboard */}
      {location.pathname === '/' && authStatus.user?.avatar && (
        <div className="app-profile-avatar" title={authStatus.user.display_name}>
          <img src={authStatus.user.avatar} alt="Profile" />
        </div>
      )}

      {/* Top Navigation */}
      <div className="app-top-nav">
        <div className="nav-pill">
          <button 
            className={`nav-icon ${isActive('/') ? 'active' : ''}`} 
            onClick={() => navigate('/')} 
            title="Dashboard"
          >
            <FiHome size={20} />
          </button>
          <button 
            className={`nav-icon ${isActive('/albums') ? 'active' : ''}`} 
            onClick={() => navigate('/albums')} 
            title="Albums"
          >
            <FiImage size={20} />
          </button>
          <button 
            className={`nav-icon ${isActive('/favorites') ? 'active' : ''}`} 
            onClick={() => navigate('/favorites')} 
            title="Favorites"
          >
            <FiHeart size={20} />
          </button>
          <button 
            className={`nav-icon ${isActive('/display') ? 'active' : ''}`} 
            onClick={() => navigate('/display')} 
            title="Display Settings"
          >
            <FiMonitor size={20} />
          </button>
          {authStatus.user?.avatar && (
            <div className="nav-avatar-wrapper" ref={menuRef}>
              <div 
                className="nav-avatar" 
                title={authStatus.user.display_name}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                <img src={authStatus.user.avatar} alt="Profile" />
              </div>
              {showProfileMenu && (
                <div className="profile-dropdown">
                  <div className="profile-dropdown-header">
                    <div className="profile-dropdown-avatar">
                      <img src={authStatus.user.avatar} alt="Profile" />
                    </div>
                    <div className="profile-dropdown-info">
                      <div className="profile-dropdown-name">{authStatus.user.display_name}</div>
                      <div className="profile-dropdown-username">@{authStatus.user.username}</div>
                    </div>
                  </div>
                  <div className="profile-dropdown-divider" />
                  <button className="profile-dropdown-item" onClick={handleLogout}>
                    <FiLogOut size={18} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Logo */}
      <div className="app-logo">
        <img src="/pixelfree-logo.svg" alt="PixelFree" className="logo-image" />
      </div>

      {/* Main Content Area */}
      <Outlet />
    </div>
  );
};

export default SharedLayout;

