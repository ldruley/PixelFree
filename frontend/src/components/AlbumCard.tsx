import React, { useState, useEffect } from 'react';
import type { Album } from '../services/albumService';
import { getAlbumPhotos, refreshAlbum } from '../services/albumService';
import type { Photo } from '../services/photoService';

interface AlbumCardProps {
  album: Album;
  isFavorites?: boolean;
  onEdit: (album: Album) => void;
  onDelete: (album: Album) => void;
  onToggle: (album: Album, enabled: boolean) => void;
}

const AlbumCard: React.FC<AlbumCardProps> = ({ 
  album, 
  isFavorites = false, 
  onEdit, 
  onDelete,
  onToggle 
}) => {
  const [previewPhotos, setPreviewPhotos] = useState<Photo[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load preview photos (first 6)
  useEffect(() => {
    const loadPreview = async () => {
      try {
        setIsLoadingPhotos(true);
        const result = await getAlbumPhotos(album.id, { limit: 6 });
        setPreviewPhotos(result.items);
      } catch (error) {
        console.error('Failed to load preview photos:', error);
      } finally {
        setIsLoadingPhotos(false);
      }
    };

    loadPreview();
  }, [album.id]);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setIsRefreshing(true);
      const refreshResult = await refreshAlbum(album.id);
      
      console.log('Refresh result:', refreshResult);
      
      // Show detailed results
      if (refreshResult.fetched === 0) {
        alert(`No photos found for album "${album.name}".\n\n` +
              `Requested: ${refreshResult.requested}\n` +
              `Fetched: ${refreshResult.fetched}\n\n` +
              `This could mean:\n` +
              `• The tag/user has no recent posts\n` +
              `• You may not have access to view those posts\n` +
              `• Try checking your backend console for detailed logs`);
      } else {
        alert(`Album refreshed successfully!\n\n` +
              `Fetched: ${refreshResult.fetched} photos\n` +
              `Saved: ${refreshResult.upserted} new photos\n` +
              `Added to album: ${refreshResult.linked} photos`);
      }
      
      // Reload preview photos
      const result = await getAlbumPhotos(album.id, { limit: 6 });
      setPreviewPhotos(result.items);
    } catch (error) {
      console.error('Failed to refresh album:', error);
      alert(`Failed to refresh album "${album.name}"\n\n` +
            `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
            `Check your backend console for more details.`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getQueryDescription = () => {
    const { type, tags, users, tagmode } = album.query;
    const parts: string[] = [];

    if (type === 'tag' || type === 'compound') {
      const tagText = tags?.length ? tags.map(t => `#${t}`).join(', ') : '';
      if (tagText) {
        parts.push(`Tags: ${tagText} (${tagmode})`);
      }
    }

    if (type === 'user' || type === 'compound') {
      const userAccts = users?.accts || [];
      if (userAccts.length > 0) {
        parts.push(`Users: ${userAccts.join(', ')}`);
      }
    }

    return parts.join(' • ') || 'No query defined';
  };

  return (
    <div className="album-card">
      <div className="album-card-header">
        <div className="album-info">
          <h3 className="album-name">
            {isFavorites && <span className="favorites-icon">[*]</span>}
            {album.name}
          </h3>
          <p className="album-query">{getQueryDescription()}</p>
          <p className="album-stats">
            {album.stats?.total || 0} photos
            {album.refresh.last_checked_at && (
              <> • Last updated: {new Date(album.refresh.last_checked_at).toLocaleDateString()}</>
            )}
          </p>
        </div>
        <div className="album-actions">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={album.enabled}
              onChange={(e) => onToggle(album, e.target.checked)}
              aria-label={`Toggle ${album.name} album ${album.enabled ? 'on' : 'off'}`}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      {/* Preview Grid */}
      <div className="album-preview-grid">
        {isLoadingPhotos ? (
          <div className="preview-loading">Loading preview...</div>
        ) : previewPhotos.length > 0 ? (
          previewPhotos.slice(0, 6).map((photo) => (
            <div key={photo.id} className="preview-photo">
              <img
                src={photo.preview_url || photo.url}
                alt={photo.caption || 'Photo'}
                loading="lazy"
              />
            </div>
          ))
        ) : (
          <div className="preview-empty">No photos yet</div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="album-card-footer">
        <button
          className="btn btn-secondary"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => onEdit(album)}
        >
          Edit
        </button>
        {!isFavorites && (
          <button
            className="btn btn-danger"
            onClick={() => onDelete(album)}
          >
            Delete
          </button>
        )}
      </div>

      <style>{`
        .album-card {
          border: 1px solid #e0e0e0;
          border-radius: 12px;
          padding: 20px;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .album-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .album-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .album-info {
          flex: 1;
        }

        .album-name {
          margin: 0 0 8px 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #333;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .favorites-icon {
          font-size: 1.1rem;
        }

        .album-query {
          margin: 0 0 4px 0;
          font-size: 0.875rem;
          color: #666;
        }

        .album-stats {
          margin: 0;
          font-size: 0.8rem;
          color: #999;
        }

        .album-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* Toggle Switch */
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 48px;
          height: 24px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: 0.3s;
          border-radius: 24px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        .toggle-switch input:checked + .toggle-slider {
          background-color: #4CAF50;
        }

        .toggle-switch input:checked + .toggle-slider:before {
          transform: translateX(24px);
        }

        /* Preview Grid */
        .album-preview-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 16px;
          min-height: 120px;
          background: #f5f5f5;
          border-radius: 8px;
          padding: 8px;
        }

        .preview-photo {
          aspect-ratio: 1;
          overflow: hidden;
          border-radius: 6px;
          background: #e0e0e0;
        }

        .preview-photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .preview-loading,
        .preview-empty {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #999;
          font-size: 0.875rem;
          padding: 20px;
        }

        /* Footer Buttons */
        .album-card-footer {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #f0f0f0;
          color: #333;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #e0e0e0;
        }

        .btn-danger {
          background: #f44336;
          color: white;
        }

        .btn-danger:hover:not(:disabled) {
          background: #d32f2f;
        }
      `}</style>
    </div>
  );
};

export default AlbumCard;

