import React, { useState, useEffect } from 'react';
import { listFavorites, removeFavorite, type FavoritePhoto } from '../services/favoritesService';

const FavoritesPage: React.FC = () => {
  const [favorites, setFavorites] = useState<FavoritePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState<FavoritePhoto | null>(null);

  // Helper function to strip HTML tags from caption
  const stripHtml = (html: string | undefined): string => {
    if (!html) return '';
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await listFavorites({ limit: 100 });
      setFavorites(response.items);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load favorites');
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
      alert(err instanceof Error ? err.message : 'Failed to remove favorite');
    }
  };

  const handlePhotoClick = (photo: FavoritePhoto) => {
    setSelectedPhoto(photo);
  };

  const handleCloseModal = () => {
    setSelectedPhoto(null);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Favorites</h1>
          <p className="page-subtitle">{total} favorite photo{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="empty-state">
          Loading favorites...
        </div>
      ) : favorites.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-message">No favorites yet</p>
          <p className="empty-state-description">
            Favorite photos from the player or album galleries to see them here
          </p>
        </div>
      ) : (
        <div className="favorites-grid">
          {favorites.map((photo) => (
            <div key={photo.id} className="favorite-card">
              <div className="favorite-image-container" onClick={() => handlePhotoClick(photo)}>
                <img
                  src={photo.preview_url || photo.url}
                  alt={photo.caption || 'Favorite photo'}
                  className="favorite-image"
                />
                <div className="favorite-overlay">
                  <button
                    className="favorite-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFavorite(photo.id);
                    }}
                    title="Remove from favorites"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </button>
                </div>
              </div>
              {photo.caption && (
                <div className="favorite-caption">
                  {stripHtml(photo.caption).substring(0, 60)}{stripHtml(photo.caption).length > 60 ? '...' : ''}
                </div>
              )}
              {photo.author_display_name && (
                <div className="favorite-author">
                  by {photo.author_display_name}
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
                {selectedPhoto.favorited_at && (
                  <p className="photo-modal-date">
                    Favorited {new Date(selectedPhoto.favorited_at).toLocaleDateString()}
                  </p>
                )}
                <button
                  className="btn btn-danger"
                  onClick={() => handleRemoveFavorite(selectedPhoto.id)}
                >
                  Remove from Favorites
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .favorites-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 20px;
          padding: 20px 0;
        }

        .favorite-card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .favorite-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }

        .favorite-image-container {
          position: relative;
          aspect-ratio: 1;
          overflow: hidden;
          cursor: pointer;
          background: #f0f0f0;
        }

        .favorite-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s;
        }

        .favorite-image-container:hover .favorite-image {
          transform: scale(1.05);
        }

        .favorite-overlay {
          position: absolute;
          top: 0;
          right: 0;
          padding: 12px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .favorite-card:hover .favorite-overlay {
          opacity: 1;
        }

        .favorite-remove-btn {
          background: rgba(244, 67, 54, 0.9);
          color: white;
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

        .favorite-remove-btn:hover {
          background: rgba(211, 47, 47, 0.95);
          transform: scale(1.1);
        }

        .favorite-caption {
          padding: 12px 12px 4px 12px;
          font-size: 0.875rem;
          color: #333;
          line-height: 1.4;
        }

        .favorite-author {
          padding: 0 12px 12px 12px;
          font-size: 0.75rem;
          color: #666;
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
          margin: 0 0 4px 0;
          font-size: 0.875rem;
          color: #666;
        }

        .photo-modal-date {
          margin: 0 0 16px 0;
          font-size: 0.75rem;
          color: #999;
        }

        @media (max-width: 768px) {
          .favorites-grid {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default FavoritesPage;

