import React, { useState, useRef, useEffect } from 'react';
import {  useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {  FiLogOut } from 'react-icons/fi';
import { showError } from '../utils/toast';
import '../styles/player.css';

const SharedLayout: React.FC = () => {
  const navigate = useNavigate();
  const { authStatus, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);



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
      <div className="app-simple-header">

        {/* Centered Larger Logo */}
        <div className="simple-header-logo">
          <img src="/pixelfree-logo.svg" alt="PixelFree" />
        </div>

        {/* Avatar + Dropdown */}
        {authStatus.user && (
            <div className="simple-header-avatar-wrapper" ref={menuRef}>
              <div
                  className="simple-header-avatar"
                  title={authStatus.user.display_name}
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                <img src={authStatus.user.avatar} alt="Profile" />
              </div>

              {showProfileMenu && (
                  <div className="simple-profile-dropdown">
                    <div className="simple-profile-header">
                      <div className="simple-profile-avatar">
                        <img src={authStatus.user.avatar} alt="Profile" />
                      </div>
                      <div className="simple-profile-info">
                        <div className="simple-profile-name">{authStatus.user.display_name}</div>
                        <div className="simple-profile-username">@{authStatus.user.username}</div>
                      </div>
                    </div>

                    <div className="simple-profile-divider" />

                    <button className="simple-profile-item" onClick={handleLogout}>
                      <FiLogOut size={18} />
                      <span>Logout</span>
                    </button>
                  </div>
              )}
            </div>
        )}
      </div>
  );


};

export default SharedLayout;

