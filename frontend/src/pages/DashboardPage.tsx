import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { listAlbums, getAlbumPhotos, type Album } from '../services/albumService';
import type { Photo } from '../services/photoService';
import { FiImage, FiChevronDown, FiChevronLeft, FiChevronRight, FiSettings } from 'react-icons/fi';
import Loading from '../components/Loading';
import { showInfo } from '../utils/toast';
import { loadAllPages } from '../utils/helpers';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { authStatus } = useAuth();
  const { settings, updateSettings } = useSettings();
  
  const [albums, setAlbums] = useState<Album[]>([]);
  const [currentAlbum, setCurrentAlbum] = useState<Album | null>(null);
  const [previewPhotos, setPreviewPhotos] = useState<Photo[]>([]);
  const [albumThumbnails, setAlbumThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [carouselStart, setCarouselStart] = useState(0);
  const [showDisplayDropdown, setShowDisplayDropdown] = useState(false);
  const [selectedDisplay, setSelectedDisplay] = useState('Living Room');

  // Layout state
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 1024 : false);
  const [activeTab, setActiveTab] = useState<'album' | 'display'>('album');

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 1024);
    };
    
    // Initial check
    checkMobile();
    
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Define callbacks first (before useEffects that use them)
  const loadCurrentAlbumPhotos = useCallback(async () => {
    if (!currentAlbum) return;
    
    try {
      // Load 4 photos for grid layout preview
      const response = await getAlbumPhotos(currentAlbum.id, { limit: 4 });
      setPreviewPhotos(response.items);
    } catch (error) {
      console.error('Failed to load album photos:', error);
    }
  }, [currentAlbum]);

  const loadAlbumThumbnails = async (albumsList: Album[]) => {
    // Load all thumbnails in parallel for better performance
    const thumbnailPromises = albumsList.map(async (album) => {
      try {
        const response = await getAlbumPhotos(album.id, { limit: 1 });
        if (response.items.length > 0) {
          return { id: album.id, url: response.items[0].preview_url || response.items[0].url };
        }
        return null;
      } catch (error) {
        console.error(`Failed to load thumbnail for album ${album.id}:`, error);
        return null;
      }
    });

    const results = await Promise.all(thumbnailPromises);
    const thumbnails: Record<string, string> = {};
    results.forEach(result => {
      if (result) {
        thumbnails[result.id] = result.url;
      }
    });
    
    setAlbumThumbnails(thumbnails);
  };

  const loadAlbums = async () => {
    try {
      setLoading(true);
      const allAlbums = await loadAllPages<Album>(listAlbums);
      const enabledAlbums = allAlbums.filter(a => a.enabled);
      setAlbums(enabledAlbums);
      
      // Set current album based on settings or first enabled
      const active = enabledAlbums.find(a => a.id === settings.activeAlbum) || enabledAlbums[0];
      if (active) {
        setCurrentAlbum(active);
      }

      // Load thumbnails for all albums
      loadAlbumThumbnails(enabledAlbums);
    } catch (error) {
      console.error('Failed to load albums:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load albums on mount
  useEffect(() => {
    loadAlbums();
  }, []);

  // Load current album photos when album changes
  useEffect(() => {
    if (currentAlbum) {
      loadCurrentAlbumPhotos();
    }
  }, [currentAlbum, loadCurrentAlbumPhotos]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showDisplayDropdown && !target.closest('.display-selector-wrapper')) {
        setShowDisplayDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showDisplayDropdown]);

  const handleAlbumSelect = (album: Album) => {
    setCurrentAlbum(album);
    updateSettings({ activeAlbum: album.id });
  };

  const handleLayoutChange = (layout: 'single' | 'grid' | 'split') => {
    updateSettings({ layout });
  };

  const handleTransitionChange = (transition: 'none' | 'fade' | 'slide') => {
    updateSettings({ transition });
  };

  const handleTimingChange = (timing: '10s' | '30s' | '1m') => {
    updateSettings({ timing });
  };

  const handleAddDisplay = () => {
    showInfo('Multiple displays feature coming soon!');
    setShowDisplayDropdown(false);
  };

  const handleDisplaySelect = (display: string) => {
    setSelectedDisplay(display);
    setShowDisplayDropdown(false);
  };

  const visibleAlbums = albums.slice(carouselStart, carouselStart + 4);
  const canScrollLeft = carouselStart > 0;
  const canScrollRight = carouselStart + 4 < albums.length;

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (direction === 'left' && canScrollLeft) {
      setCarouselStart(carouselStart - 1);
    } else if (direction === 'right' && canScrollRight) {
      setCarouselStart(carouselStart + 1);
    }
  };

  if (loading) {
    return (
      <div className="app-content">
        <Loading />
      </div>
    );
  }

  // Render Functions for Sections
  const renderAlbumContent = () => (
    <div className="album-carousel-container">
      <button 
        className="carousel-nav left"
        onClick={() => scrollCarousel('left')}
        disabled={!canScrollLeft}
        title="Previous albums"
      >
        <FiChevronLeft size={24} />
      </button>
      
      <div className="album-carousel">
        {visibleAlbums.map((album) => (
          <div 
            key={album.id} 
            className={`album-thumb ${currentAlbum?.id === album.id ? 'active' : ''}`}
            onClick={() => handleAlbumSelect(album)}
          >
            <div className="album-thumb-image">
              {albumThumbnails[album.id] ? (
                <img src={albumThumbnails[album.id]} alt={album.name} />
              ) : (
                <div className="album-placeholder" />
              )}
            </div>
            <p className="album-thumb-name">{album.name}</p>
          </div>
        ))}
      </div>

      <button 
        className="carousel-nav right"
        onClick={() => scrollCarousel('right')}
        disabled={!canScrollRight}
        title="Next albums"
      >
        <FiChevronRight size={24} />
      </button>
    </div>
  );

  const renderDisplaySettingsContent = () => (
    <div className="display-settings">
      {/* Display Layout */}
      <div className="setting-group">
        <label>Display Layout</label>
        <div className="layout-options">
          <button 
            className={`layout-btn ${settings.layout === 'single' ? 'active' : ''}`}
            onClick={() => handleLayoutChange('single')}
            title="Single Image"
          >
            <div className="layout-icon single">
              <div className="layout-box full" />
            </div>
            <span>Single</span>
          </button>
          <button 
            className={`layout-btn ${settings.layout === 'grid' ? 'active' : ''}`}
            onClick={() => handleLayoutChange('grid')}
            title="2×2 Grid"
          >
            <div className="layout-icon grid">
              <div className="layout-box" />
              <div className="layout-box" />
              <div className="layout-box" />
              <div className="layout-box" />
            </div>
            <span>Grid</span>
          </button>
          <button 
            className={`layout-btn ${settings.layout === 'split' ? 'active' : ''}`}
            onClick={() => handleLayoutChange('split')}
            title="Split View"
          >
            <div className="layout-icon split">
              <div className="layout-box" />
              <div className="layout-box" />
            </div>
            <span>Split</span>
          </button>
        </div>
      </div>

      {/* Transition Type */}
      <div className="setting-group">
        <label>Transition</label>
        <div className="transition-options">
          <button 
            className={`transition-btn ${settings.transition === 'none' ? 'active' : ''}`}
            onClick={() => handleTransitionChange('none')}
          >
            None
          </button>
          <button 
            className={`transition-btn ${settings.transition === 'fade' ? 'active' : ''}`}
            onClick={() => handleTransitionChange('fade')}
          >
            Fade
          </button>
          <button 
            className={`transition-btn ${settings.transition === 'slide' ? 'active' : ''}`}
            onClick={() => handleTransitionChange('slide')}
          >
            Slide
          </button>
        </div>
      </div>

      {/* Duration */}
      <div className="setting-group">
        <label>Duration</label>
        <div className="duration-pills">
          <button 
            className={settings.timing === '10s' ? 'active' : ''}
            onClick={() => handleTimingChange('10s')}
          >
            10s
          </button>
          <button 
            className={settings.timing === '30s' ? 'active' : ''}
            onClick={() => handleTimingChange('30s')}
          >
            30s
          </button>
          <button 
            className={settings.timing === '1m' ? 'active' : ''}
            onClick={() => handleTimingChange('1m')}
          >
            1m
          </button>
        </div>
      </div>

      {/* Current Settings Summary */}
      <div className="settings-summary">
        <div className="summary-item">
          <span className="summary-label">Active Album</span>
          <span className="summary-value">{currentAlbum?.name || 'None'}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Photos</span>
          <span className="summary-value">{currentAlbum?.stats?.total || 0}</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button 
          className="btn-view-settings"
          onClick={() => navigate('/display')}
        >
          Advanced Settings
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-content dashboard-layout">
      {/* Left Section - User & Current Display */}
      <div className="layout-main">
        {/* Greeting */}
        <h1 className="app-page-title">
          {getGreeting()} {authStatus.user?.display_name?.split(' ')[0] || 'there'}!
        </h1>

        {/* Display Selector */}
        <div className="display-selector-wrapper">
          <div className="album-selector" onClick={() => setShowDisplayDropdown(!showDisplayDropdown)}>
            <FiChevronDown size={18} />
            <span>{selectedDisplay}</span>
          </div>
          
          {showDisplayDropdown && (
            <div className="display-dropdown">
              <div 
                className={`display-option ${selectedDisplay === 'Living Room' ? 'active' : ''}`}
                onClick={() => handleDisplaySelect('Living Room')}
              >
                Living Room
              </div>
              <div 
                className="display-option add-display"
                onClick={handleAddDisplay}
              >
                + Add Display
              </div>
            </div>
          )}
        </div>

        {/* Display Preview - Shows layout based on settings */}
        <div className="current-photo-display">
          {previewPhotos.length > 0 ? (
            <>
              {settings.layout === 'single' && (
                <div className="preview-single">
                  <img 
                    src={previewPhotos[0].preview_url || previewPhotos[0].url} 
                    alt={previewPhotos[0].caption || 'Preview'} 
                  />
                </div>
              )}
              
              {settings.layout === 'grid' && (
                <div className="preview-grid">
                  {previewPhotos.slice(0, 4).map((photo, index) => (
                    <div key={photo.id || index} className="preview-grid-item">
                      <img 
                        src={photo.preview_url || photo.url} 
                        alt={photo.caption || `Photo ${index + 1}`} 
                      />
                    </div>
                  ))}
                  {/* Fill remaining slots if less than 4 photos */}
                  {previewPhotos.length < 4 && Array.from({ length: 4 - previewPhotos.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="preview-grid-item preview-empty-slot">
                      <div className="empty-slot-content">No photo</div>
                    </div>
                  ))}
                </div>
              )}
              
              {settings.layout === 'split' && (
                <div className="preview-split">
                  <div className="preview-split-item">
                    <img 
                      src={previewPhotos[0].preview_url || previewPhotos[0].url} 
                      alt={previewPhotos[0].caption || 'Photo 1'} 
                    />
                  </div>
                  {previewPhotos.length > 1 ? (
                    <div className="preview-split-item">
                      <img 
                        src={previewPhotos[1].preview_url || previewPhotos[1].url} 
                        alt={previewPhotos[1].caption || 'Photo 2'} 
                      />
                    </div>
                  ) : (
                    <div className="preview-split-item preview-empty-slot">
                      <div className="empty-slot-content">No photo</div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="photo-overlay">
                <h2 className="photo-title">
                  {settings.layout === 'single' && '1 Photo'}
                  {settings.layout === 'grid' && '2×2 Grid'}
                  {settings.layout === 'split' && 'Split View'}
                </h2>
                <p className="photo-subtitle">DISPLAY PREVIEW • {currentAlbum?.name}</p>
              </div>
            </>
          ) : (
            <div className="no-photo">
              <p>No photos in this album</p>
            </div>
          )}
        </div>

        {/* Desktop: Change Album Section (Left Column) */}
        {!isMobile && (
          <div className="change-album-section">
            <div className="section-tab active">
              <FiImage size={20} />
              <span>Change Album</span>
            </div>
            <div className="section-content album-content">
              {renderAlbumContent()}
            </div>
          </div>
        )}

        {/* Mobile: Merged Tabs Section */}
        {isMobile && (
          <div className="mobile-tabs-section">
            <div className="tabs-header">
              <button 
                className={`tab-btn ${activeTab === 'album' ? 'active' : ''}`}
                onClick={() => setActiveTab('album')}
              >
                <FiImage size={20} />
                <span>Change Album</span>
              </button>
              <button 
                className={`tab-btn ${activeTab === 'display' ? 'active' : ''}`}
                onClick={() => setActiveTab('display')}
              >
                <FiSettings size={20} />
                <span>Adjust Display</span>
              </button>
            </div>
            <div className="section-content mobile-content">
              {activeTab === 'album' ? renderAlbumContent() : renderDisplaySettingsContent()}
            </div>
          </div>
        )}
      </div>

      {/* Right Section - Adjust Display */}
      <div className="layout-sidebar">
        {!isMobile && (
          <div className="adjust-display-section">
            <div className="section-tab active">
              <FiSettings size={20} />
              <span>Adjust Display</span>
            </div>
            <div className="section-content display-content">
              {renderDisplaySettingsContent()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
