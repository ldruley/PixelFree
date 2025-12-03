import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  listAlbums, 
  createAlbum, 
  deleteAlbum,
  refreshAlbum,
  type Album, 
  type CreateAlbumRequest 
} from '../services/albumService';
import { getAlbumPhotos } from '../services/albumService';
import { FiPlus, FiCheck } from 'react-icons/fi';
import AlbumForm from '../components/AlbumForm';
import Loading from '../components/Loading';
import { showError, showSuccess } from '../utils/toast';
import { loadAllPages } from '../utils/helpers';

const AlbumsPage: React.FC = () => {
  const navigate = useNavigate();
  
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumThumbnails, setAlbumThumbnails] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<string>>(new Set());
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);

  // Load albums on mount
  useEffect(() => {
    loadAlbums();
  }, []);

  const loadAlbums = async () => {
    try {
      setIsLoading(true);
      
      // Fetch all albums using helper (no limit on albums)
      const allAlbums = await loadAllPages<Album>(listAlbums);
      
      setAlbums(allAlbums);
      
      // Load thumbnails
      loadAlbumThumbnails(allAlbums);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load albums');
      console.error('Error loading albums:', err);
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleCreateAlbum = async (data: CreateAlbumRequest) => {
    try {
      const newAlbum = await createAlbum(data);
      setShowForm(false);
      
      // Automatically fetch photos for the new album
      try {
        await refreshAlbum(newAlbum.id);
      } catch (refreshErr) {
        console.error('Failed to fetch photos for new album:', refreshErr);
      }
      
      await loadAlbums();
    } catch (err) {
      console.error('Failed to create album:', err);
      showError(err instanceof Error ? err.message : 'Failed to create album');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedAlbumIds.size === 0) return;
    
    if (confirm(`Are you sure you want to delete ${selectedAlbumIds.size} albums?`)) {
      try {
        for (const id of selectedAlbumIds) {
          await deleteAlbum(id);
        }
        setSelectedAlbumIds(new Set());
        setIsSelectionMode(false);
        await loadAlbums();
        showSuccess(`Successfully deleted ${selectedAlbumIds.size} album(s)`);
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Failed to delete albums');
      }
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedAlbumIds(new Set());
  };

  const handleCardClick = (albumId: string) => {
    if (isSelectionMode) {
      // Toggle selection if in selection mode
      const newSelected = new Set(selectedAlbumIds);
      if (newSelected.has(albumId)) {
        newSelected.delete(albumId);
      } else {
        newSelected.add(albumId);
      }
      setSelectedAlbumIds(newSelected);
    } else {
      // Navigate to album
      navigate(`/albums/${albumId}`);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingAlbum(null);
  };

  const handleNewAlbum = () => {
    setEditingAlbum(null);
    setShowForm(true);
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
        <h1 className="app-page-title">Albums</h1>
        <button className="action-btn" onClick={toggleSelectionMode}>
          {isSelectionMode ? 'Done' : 'Select'}
        </button>
      </div>

      <div className="albums-grid-container">
        {albums.map((album) => (
          <div 
            key={album.id} 
            className="album-card"
            onClick={() => handleCardClick(album.id)}
          >
            <div className="album-card-image">
              {albumThumbnails[album.id] ? (
                <img src={albumThumbnails[album.id]} alt={album.name} />
              ) : (
                <div className="album-placeholder" />
              )}
              
              {isSelectionMode && (
                <div 
                  className={`selection-checkbox ${selectedAlbumIds.has(album.id) ? 'selected' : ''}`}
                >
                  {selectedAlbumIds.has(album.id) && <FiCheck size={14} />}
                </div>
              )}
            </div>
            <span className="album-card-title">{album.name}</span>
          </div>
        ))}

        {/* Create New Card */}
        <div className="album-card" onClick={handleNewAlbum}>
          <div className="create-new-card">
            <FiPlus className="create-new-icon" />
          </div>
          <span className="album-card-title">Create New</span>
        </div>
      </div>

      {/* Bottom Action Bar (Selection Mode) */}
      {isSelectionMode && (
        <div className="bottom-action-bar">
          <button className="pill-btn cancel" onClick={toggleSelectionMode}>
            Cancel
          </button>
          {selectedAlbumIds.size > 0 && (
            <button className="pill-btn delete" onClick={handleDeleteSelected}>
              Delete ({selectedAlbumIds.size})
            </button>
          )}
        </div>
      )}

      {/* Album Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={handleFormClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <AlbumForm
              album={editingAlbum}
              onSave={handleCreateAlbum}
              onCancel={handleFormClose}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AlbumsPage;
