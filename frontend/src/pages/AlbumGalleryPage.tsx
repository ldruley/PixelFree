import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAlbum, getAlbumPhotos, type Album } from '../services/albumService';
import { addFavorite, removeFavorite, batchCheckFavorites } from '../services/favoritesService';
import type { Photo } from '../services/photoService';

const AlbumGalleryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [total, setTotal] = useState(0);

  // Helper function to strip HTML tags from caption
  const stripHtml = (html: string | undefined): string => {
    if (!html) return '';
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  useEffect(() => {
    if (id) {
      loadAlbumAndPhotos();
    }
  }, [id]);

  const loadAlbumAndPhotos = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      setError(null);

      // Load album details and photos in parallel
      const [albumData, photosData] = await Promise.all([
        getAlbum(id),
        getAlbumPhotos(id, { limit: 100 })
      ]);

      setAlbum(albumData);
      setPhotos(photosData.items);
      setTotal(photosData.total);

      // Batch check favorite status for all photos
      if (photosData.items.length > 0) {
        const statusIds = photosData.items.map(p => p.id);
        const favStatus = await batchCheckFavorites(statusIds);
        setFavorites(favStatus);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load album');
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
      alert(err instanceof Error ? err.message : 'Failed to update favorite');
    }
  };

  const handlePhotoClick = (photo: Photo) => {
    setSelectedPhoto(photo);
  };

  const handleCloseModal = () => {
    setSelectedPhoto(null);
  };

  const handleBack = () => {
    navigate('/albums');
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="empty-state">
          Loading album...
        </div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="page-container">
        <div className="error-banner">
          {error || 'Album not found'}
        </div>
        <button className="btn btn-secondary" onClick={handleBack}>
          ← Back to Albums
        </button>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <button className="back-button" onClick={handleBack}>
            ← Back
          </button>
          <h1 className="page-title">{album.name}</h1>
          <p className="page-subtitle">
            {total} photo{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-message">No photos in this album yet</p>
          <p className="empty-state-description">
            Try refreshing the album to fetch new photos
          </p>
        </div>
      ) : (
        <div className="gallery-grid">
          {photos.map((photo) => (
            <div key={photo.id} className="gallery-card">
              <div className="gallery-image-container" onClick={() => handlePhotoClick(photo)}>
                <img
                  src={photo.preview_url || photo.url}
                  alt={photo.caption || 'Photo'}
                  className="gallery-image"
                />
                <div className="gallery-overlay">
                  <button
                    className={`favorite-btn ${favorites[photo.id] ? 'favorited' : ''}`}
                    onClick={(e) => handleToggleFavorite(photo, e)}
                    title={favorites[photo.id] ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill={favorites[photo.id] ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </button>
                </div>
              </div>
              {photo.caption && (
                <div className="gallery-caption">
                  {stripHtml(photo.caption).substring(0, 60)}{stripHtml(photo.caption).length > 60 ? '...' : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content photo-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleCloseModal}>×</button>
            <div className="photo-modal-content">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.caption || 'Photo'}
                className="photo-modal-image"
              />
              <div className="photo-modal-details">
                {selectedPhoto.caption && (
                  <p className="photo-modal-caption">{stripHtml(selectedPhoto.caption)}</p>
                )}
                {selectedPhoto.author_display_name && (
                  <p className="photo-modal-author">by {selectedPhoto.author_display_name}</p>
                )}
                <button
                  className={`btn ${favorites[selectedPhoto.id] ? 'btn-danger' : 'btn-primary'}`}
                  onClick={() => handleToggleFavorite(selectedPhoto)}
                >
                  {favorites[selectedPhoto.id] ? '♥ Remove from Favorites' : '♡ Add to Favorites'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .back-button {
          background: none;
          border: none;
          color: #2196F3;
          font-size: 0.95rem;
          cursor: pointer;
          padding: 8px 0;
          margin-bottom: 8px;
          display: inline-block;
          transition: color 0.2s;
        }

        .back-button:hover {
          color: #1976D2;
          text-decoration: underline;
        }

        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 20px;
          padding: 20px 0;
        }

        .gallery-card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .gallery-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }

        .gallery-image-container {
          position: relative;
          aspect-ratio: 1;
          overflow: hidden;
          cursor: pointer;
          background: #f0f0f0;
        }

        .gallery-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s;
        }

        .gallery-image-container:hover .gallery-image {
          transform: scale(1.05);
        }

        .gallery-overlay {
          position: absolute;
          top: 0;
          right: 0;
          padding: 12px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .gallery-card:hover .gallery-overlay {
          opacity: 1;
        }

        .favorite-btn {
          background: rgba(255, 255, 255, 0.9);
          color: #666;
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }

        .favorite-btn:hover {
          background: white;
          transform: scale(1.1);
        }

        .favorite-btn.favorited {
          color: #f44336;
          background: white;
        }

        .favorite-btn.favorited:hover {
          color: #d32f2f;
        }

        .gallery-caption {
          padding: 12px;
          font-size: 0.875rem;
          color: #333;
          line-height: 1.4;
        }

        .photo-modal {
          max-width: 90vw;
          max-height: 90vh;
          padding: 0;
          overflow: hidden;
        }

        .photo-modal-content {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .photo-modal-image {
          flex: 1;
          width: 100%;
          object-fit: contain;
          background: #000;
        }

        .photo-modal-details {
          padding: 20px;
          background: white;
          border-top: 1px solid #e0e0e0;
        }

        .photo-modal-caption {
          margin: 0 0 8px 0;
          font-size: 1rem;
          color: #333;
        }

        .photo-modal-author {
          margin: 0 0 16px 0;
          font-size: 0.875rem;
          color: #666;
        }

        @media (max-width: 768px) {
          .gallery-grid {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default AlbumGalleryPage;

