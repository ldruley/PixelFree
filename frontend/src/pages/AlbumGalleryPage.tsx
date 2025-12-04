import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAlbum, getAlbumPhotos, updateAlbum, type Album } from '../services/albumService';
import { addFavorite, removeFavorite, batchCheckFavorites } from '../services/favoritesService';
import type { Photo } from '../services/photoService';
import { FiCheck, FiHeart, FiInfo, FiX, FiEyeOff, FiTag, FiPlus, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import Loading from '../components/Loading';
import { showError, showSuccess, showInfo } from '../utils/toast';
import { stripHtml, loadAllPages } from '../utils/helpers';
import { APP_CONFIG } from '../config';
import '../styles/AppLayout.css';

const AlbumGalleryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showPhotoInfo, setShowPhotoInfo] = useState(true);
  
  // Tag Editing
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [albumTags, setAlbumTags] = useState<string[]>([]);

  // Selection Mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());

  // Define callbacks first (before useEffects that use them)
  const handleCloseModal = useCallback(() => {
    setSelectedPhoto(null);
  }, []);

  const handleNextPhoto = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!selectedPhoto || photos.length === 0) return;
    
    const currentIndex = photos.findIndex(p => p.id === selectedPhoto.id);
    const nextIndex = (currentIndex + 1) % photos.length;
    setSelectedPhoto(photos[nextIndex]);
  }, [selectedPhoto, photos]);

  const handlePrevPhoto = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!selectedPhoto || photos.length === 0) return;
    
    const currentIndex = photos.findIndex(p => p.id === selectedPhoto.id);
    const prevIndex = (currentIndex - 1 + photos.length) % photos.length;
    setSelectedPhoto(photos[prevIndex]);
  }, [selectedPhoto, photos]);

  useEffect(() => {
    if (id) {
      loadAlbumAndPhotos();
    }
  }, [id]);

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

  const loadAlbumAndPhotos = async () => {
    if (!id) return;

    try {
      setIsLoading(true);

      // Load album details first
      const albumData = await getAlbum(id);
      setAlbum(albumData);
      setAlbumTags(albumData.query.tags || []);

      // Fetch all photos with progressive loading and max limit
      const allPhotos = await loadAllPages<Photo>(
        (params) => getAlbumPhotos(id, params),
        100,
        (photos) => setPhotos(photos), // Update UI progressively as batches load
        APP_CONFIG.MAX_ALBUM_PHOTOS     // Max 1000 photos
      );
      
      // Batch check favorite status for all photos
      if (allPhotos.length > 0) {
        const statusIds = allPhotos.map(p => p.id);
        const favStatus = await batchCheckFavorites(statusIds);
        setFavorites(favStatus);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load album');
      console.error('Error loading album:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = async (photo: Photo, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    const isFavorited = favorites[photo.id];
    
    try {
      if (isFavorited) {
        await removeFavorite(photo.id);
        setFavorites(prev => ({ ...prev, [photo.id]: false }));
      } else {
        await addFavorite(photo.id);
        setFavorites(prev => ({ ...prev, [photo.id]: true }));
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update favorite');
    }
  };

  const handlePhotoClick = (photo: Photo) => {
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
    showInfo("Delete functionality not implemented yet for photos.");
  };

  // Album Tag Management
  const handleAddTag = async () => {
    if (!newTag.trim() || !album) return;
    
    const updatedTags = [...albumTags, newTag.trim()];
    setAlbumTags(updatedTags);
    setNewTag('');
    
    try {
      await updateAlbum(album.id, {
        query: {
          ...album.query,
          tags: updatedTags
        }
      });
    } catch (err) {
      console.error('Failed to update tags:', err);
      // Revert on failure
      setAlbumTags(albumTags);
      showError('Failed to update tags');
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!album) return;
    
    const updatedTags = albumTags.filter(t => t !== tagToRemove);
    setAlbumTags(updatedTags);
    
    try {
      await updateAlbum(album.id, {
        query: {
          ...album.query,
          tags: updatedTags
        }
      });
      showSuccess('Tag removed');
    } catch (err) {
      console.error('Failed to update tags:', err);
      setAlbumTags(albumTags);
      showError('Failed to update tags');
    }
  };

  if (isLoading) {
    return (
      <div className="app-content">
        <Loading />
      </div>
    );
  }

  if (!album) {
    return (
      <div className="app-content">
        <div className="error-banner">
          Album not found
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/albums')}>
          ← Back to Albums
        </button>
      </div>
    );
  }

  return (
    <div className="app-content">
      <div className="page-header-actions">
        <h1 className="app-page-title">
          <span 
            onClick={() => navigate('/albums')} 
            className="breadcrumb-nav"
          >
            Albums
          </span>
          <span className="breadcrumb-separator">/</span>
          <span>{album.name}</span>
        </h1>
        <button className="action-btn" onClick={toggleSelectionMode}>
          {isSelectionMode ? 'Done' : 'Select'}
        </button>
      </div>

      {/* Album Tags / Query Section */}
      <div className="album-query-section">
        <div className="album-tags-header">
          <h3 className="album-tags-title">
            Album Tags
          </h3>
          <button 
            className="action-btn action-btn-small"
            onClick={() => setIsEditingTags(!isEditingTags)}
          >
            {isEditingTags ? 'Done' : 'Edit'}
          </button>
        </div>
        
        <div className="query-tags-container">
          {albumTags.map((tag) => (
            <div key={tag} className="query-tag">
              <FiTag size={14} />
              <span>#{tag}</span>
              {isEditingTags && (
                <FiX 
                  size={14} 
                  className="icon-clickable"
                  onClick={() => handleRemoveTag(tag)}
                />
              )}
            </div>
          ))}
          {albumTags.length === 0 && !isEditingTags && (
            <span className="no-tags-text">No tags set</span>
          )}
        </div>

        {isEditingTags && (
          <div className="tag-input-wrapper">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="Add a tag..."
              className="tag-input"
            />
            <button className="add-tag-btn" onClick={handleAddTag}>
              <FiPlus size={16} />
            </button>
          </div>
        )}
      </div>

      {photos.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-message">No photos in this album yet</p>
        </div>
      ) : (
        <div className="albums-grid-container">
          {photos.map((photo) => (
            <div key={photo.id} className="album-card" onClick={() => handlePhotoClick(photo)}>
              <div className="album-card-image">
                <img
                  src={photo.preview_url || photo.url}
                  alt={photo.caption || 'Photo'}
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
              Delete ({selectedPhotoIds.size})
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
                </div>
              )}
            </div>

            <div className="photo-modal-controls">
              <button 
                className={`control-btn ${favorites[selectedPhoto.id] ? 'favorite-active' : ''}`}
                onClick={() => handleToggleFavorite(selectedPhoto)}
                title="Favorite"
              >
                <FiHeart fill={favorites[selectedPhoto.id] ? "currentColor" : "none"} size={20} />
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

export default AlbumGalleryPage;