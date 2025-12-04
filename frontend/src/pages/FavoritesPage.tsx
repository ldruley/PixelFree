import React, { useState, useEffect, useCallback } from 'react';
import { listFavorites, removeFavorite, type FavoritePhoto } from '../services/favoritesService';
import { FiCheck, FiHeart, FiInfo, FiX, FiEyeOff, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import Loading from '../components/Loading';
import { showError, showSuccess } from '../utils/toast';
import { stripHtml, loadAllPages } from '../utils/helpers';
import '../styles/AppLayout.css';

const FavoritesPage: React.FC = () => {
  const [favorites, setFavorites] = useState<FavoritePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState<FavoritePhoto | null>(null);
  const [showPhotoInfo, setShowPhotoInfo] = useState(true);
  
  // Selection Mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());

  // Define callbacks first (before useEffects that use them)
  const handleCloseModal = useCallback(() => {
    setSelectedPhoto(null);
  }, []);

  const handleNextPhoto = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!selectedPhoto || favorites.length === 0) return;
    
    const currentIndex = favorites.findIndex(p => p.id === selectedPhoto.id);
    const nextIndex = (currentIndex + 1) % favorites.length;
    setSelectedPhoto(favorites[nextIndex]);
  }, [selectedPhoto, favorites]);

  const handlePrevPhoto = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!selectedPhoto || favorites.length === 0) return;
    
    const currentIndex = favorites.findIndex(p => p.id === selectedPhoto.id);
    const prevIndex = (currentIndex - 1 + favorites.length) % favorites.length;
    setSelectedPhoto(favorites[prevIndex]);
  }, [selectedPhoto, favorites]);

  useEffect(() => {
    loadFavorites();
  }, []);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedPhoto) return;
      
      if (e.key === 'ArrowLeft') {
        handlePrevPhoto();
      } else if (e.key === 'ArrowRight') {
        handleNextPhoto();
      } else if (e.key === 'Escape') {
        handleCloseModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhoto, handlePrevPhoto, handleNextPhoto, handleCloseModal]);

  const loadFavorites = async () => {
    try {
      setIsLoading(true);
      
      // Fetch all favorites using helper
      const allFavorites = await loadAllPages<FavoritePhoto>(listFavorites);
      
      setFavorites(allFavorites);
      setTotal(allFavorites.length);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load favorites');
      console.error('Error loading favorites:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFavorite = async (statusId: string) => {
    if (!confirm('Remove this photo from favorites?')) {
      return;
    }

    try {
      await removeFavorite(statusId);
      setFavorites(prev => prev.filter(f => f.id !== statusId));
      setTotal(prev => prev - 1);
      if (selectedPhoto?.id === statusId) {
        setSelectedPhoto(null);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to remove favorite');
    }
  };

  // Quick remove without confirmation for the modal toggle
  const handleToggleFavorite = async (photo: FavoritePhoto) => {
    // In favorites page, toggling means removing
    try {
      await removeFavorite(photo.id);
      setFavorites(prev => prev.filter(f => f.id !== photo.id));
      setTotal(prev => prev - 1);
      showSuccess('Removed from favorites');
      // If we remove the currently selected photo, close the modal
      handleCloseModal();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to remove favorite');
    }
  };

  const handlePhotoClick = (photo: FavoritePhoto) => {
    if (isSelectionMode) {
      const newSelected = new Set(selectedPhotoIds);
      if (newSelected.has(photo.id)) {
        newSelected.delete(photo.id);
      } else {
        newSelected.add(photo.id);
      }
      setSelectedPhotoIds(newSelected);
    } else {
      setSelectedPhoto(photo);
      setShowPhotoInfo(true);
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedPhotoIds(new Set());
  };

  const handleDeleteSelected = async () => {
    if (selectedPhotoIds.size === 0) return;

    if (confirm(`Remove ${selectedPhotoIds.size} photos from favorites?`)) {
       try {
        for (const id of selectedPhotoIds) {
          await removeFavorite(id);
        }
        // Refresh
        const remaining = favorites.filter(f => !selectedPhotoIds.has(f.id));
        setFavorites(remaining);
        setTotal(remaining.length);
        setIsSelectionMode(false);
        setSelectedPhotoIds(new Set());
        showSuccess(`Successfully removed ${selectedPhotoIds.size} photo(s) from favorites`);
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Failed to remove favorites');
      }
    }
  };


  if (isLoading) {
    return (
      <div className="app-content">
        <Loading />
      </div>
    );
  }

  return (
    <div className="app-content">
      <div className="page-header-actions">
        <h1 className="app-page-title">Favorites</h1>
        <button className="action-btn" onClick={toggleSelectionMode}>
          {isSelectionMode ? 'Done' : 'Select'}
        </button>
      </div>

      {favorites.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-message">No favorites yet</p>
          <p className="empty-state-description">
            Favorite photos from the player or album galleries to see them here
          </p>
        </div>
      ) : (
        <div className="albums-grid-container">
          {favorites.map((photo) => (
            <div key={photo.id} className="album-card" onClick={() => handlePhotoClick(photo)}>
              <div className="album-card-image">
                <img
                  src={photo.preview_url || photo.url}
                  alt={photo.caption || 'Favorite photo'}
                  className="gallery-image"
                  onError={(e) => {
                    e.currentTarget.src = '/playerlogo.png';
                    e.currentTarget.classList.add('img-error-fallback');
                  }}
                />
                
                {isSelectionMode && (
                  <div 
                    className={`selection-checkbox ${selectedPhotoIds.has(photo.id) ? 'selected' : ''}`}
                  >
                    {selectedPhotoIds.has(photo.id) && <FiCheck size={14} />}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Action Bar (Selection Mode) */}
      {isSelectionMode && (
        <div className="bottom-action-bar">
          <button className="pill-btn cancel" onClick={toggleSelectionMode}>
            Cancel
          </button>
          {selectedPhotoIds.size > 0 && (
            <button className="pill-btn delete" onClick={handleDeleteSelected}>
              Remove ({selectedPhotoIds.size})
            </button>
          )}
        </div>
      )}

      {/* New Clean Photo Modal */}
      {selectedPhoto && (
        <div className="photo-modal-overlay" onClick={handleCloseModal}>
          <div className="photo-modal-container" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={handleCloseModal} title="Close">
              <FiX />
            </button>

            {/* Navigation Buttons */}
            <button className="modal-nav-btn left" onClick={handlePrevPhoto} title="Previous Photo">
              <FiChevronLeft size={24} />
            </button>
            
            <button className="modal-nav-btn right" onClick={handleNextPhoto} title="Next Photo">
              <FiChevronRight size={24} />
            </button>

            <div className="photo-modal-image-wrapper">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.caption || 'Photo'}
                className="photo-modal-image"
                onError={(e) => {
                  e.currentTarget.src = '/playerlogo.png';
                  e.currentTarget.classList.add('img-error-fallback-large');
                }}
              />
              
              {showPhotoInfo && (selectedPhoto.caption || selectedPhoto.author_display_name) && (
                <div className="photo-info-overlay">
                  {selectedPhoto.caption && (
                    <p className="photo-info-caption">{stripHtml(selectedPhoto.caption)}</p>
                  )}
                  {selectedPhoto.author_display_name && (
                    <div className="photo-info-author">
                      <span>by {selectedPhoto.author_display_name}</span>
                    </div>
                  )}
                  {selectedPhoto.favorited_at && (
                    <p className="favorited-date">
                      Favorited {new Date(selectedPhoto.favorited_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="photo-modal-controls">
              <button 
                className="control-btn favorite-active"
                onClick={() => handleToggleFavorite(selectedPhoto)}
                title="Remove from Favorites"
              >
                <FiHeart fill="currentColor" size={20} />
              </button>
              
              <button 
                className={`control-btn ${showPhotoInfo ? 'active' : ''}`}
                onClick={() => setShowPhotoInfo(!showPhotoInfo)}
                title="Show Info"
              >
                <FiInfo size={20} />
              </button>

              <button 
                className="control-btn"
                onClick={handleCloseModal}
                title="Hide"
              >
                <FiEyeOff size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;
