import React, { useState, useEffect } from 'react';
import AlbumCard from '../components/AlbumCard';
import AlbumForm from '../components/AlbumForm';
import type { Album, CreateAlbumRequest } from '../services/albumService';
import {
  listAlbums,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  toggleAlbum,
  refreshAlbum,
} from '../services/albumService';

const AlbumsPage: React.FC = () => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
      setError(null);
      const response = await listAlbums({ limit: 100 });
      setAlbums(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load albums');
      console.error('Error loading albums:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAlbum = async (data: CreateAlbumRequest) => {
    try {
      const newAlbum = await createAlbum(data);
      setShowForm(false);
      
      // Show a loading message
      setError(null);
      
      // Automatically fetch photos for the new album
      try {
        const refreshResult = await refreshAlbum(newAlbum.id);
        console.log('Album refresh result:', refreshResult);
        
        if (refreshResult.fetched === 0) {
          alert(`Album "${newAlbum.name}" created, but no photos were found. This could mean:\n\n` +
                `• The tag/user has no recent posts\n` +
                `• You may not have access to view those posts\n` +
                `• Try a different tag or user\n\n` +
                `You can manually refresh the album later.`);
        } else {
          alert(`Album "${newAlbum.name}" created successfully!\n\n` +
                `Fetched: ${refreshResult.fetched} photos\n` +
                `Added: ${refreshResult.linked} photos to album`);
        }
      } catch (refreshErr) {
        console.error('Failed to fetch photos for new album:', refreshErr);
        alert(`Album "${newAlbum.name}" created, but failed to fetch photos.\n\n` +
              `Error: ${refreshErr instanceof Error ? refreshErr.message : 'Unknown error'}\n\n` +
              `You can try refreshing the album manually from the Albums page.`);
      }
      
      await loadAlbums();
    } catch (err) {
      console.error('Failed to create album:', err);
      throw err;
    }
  };

  const handleUpdateAlbum = async (data: CreateAlbumRequest) => {
    if (editingAlbum) {
      await updateAlbum(editingAlbum.id, data);
      await loadAlbums();
      setShowForm(false);
      setEditingAlbum(null);
    }
  };

  const handleEditAlbum = (album: Album) => {
    setEditingAlbum(album);
    setShowForm(true);
  };

  const handleDeleteAlbum = async (album: Album) => {
    if (confirm(`Are you sure you want to delete "${album.name}"?`)) {
      try {
        await deleteAlbum(album.id);
        await loadAlbums();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to delete album');
      }
    }
  };

  const handleToggleAlbum = async (album: Album, enabled: boolean) => {
    try {
      await toggleAlbum(album.id, enabled);
      await loadAlbums();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle album');
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

  return (
    <div className="page-container">
      {/* Simple Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Albums</h1>
        </div>
        <button className="btn btn-primary" onClick={handleNewAlbum}>
          + Create New Album
        </button>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="empty-state">
          Loading albums...
        </div>
      ) : albums.length > 0 ? (
        <div className="albums-grid">
          {albums.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              onEdit={handleEditAlbum}
              onDelete={handleDeleteAlbum}
              onToggle={handleToggleAlbum}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p className="empty-state-message">No albums yet</p>
          <button className="btn btn-primary" onClick={handleNewAlbum}>
            Create Album
          </button>
        </div>
      )}

      {/* Album Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={handleFormClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <AlbumForm
              album={editingAlbum}
              onSave={editingAlbum ? handleUpdateAlbum : handleCreateAlbum}
              onCancel={handleFormClose}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AlbumsPage;
