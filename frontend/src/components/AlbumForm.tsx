import React, { useState, useEffect } from 'react';
import type { Album, CreateAlbumRequest } from '../services/albumService';

interface AlbumFormProps {
  album?: Album | null; // If editing, pass existing album
  onSave: (data: CreateAlbumRequest) => Promise<void>;
  onCancel: () => void;
}

const AlbumForm: React.FC<AlbumFormProps> = ({ album, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    queryType: 'tag' as 'tag' | 'user' | 'compound',
    tags: '',
    users: '',
    tagmode: 'any' as 'any' | 'all',
    limit: 20,
    intervalMs: 600000, // 10 minutes default
    enabled: true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // State for tag chips
  const [tagChips, setTagChips] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Populate form when editing
  useEffect(() => {
    if (album) {
      const tags = album.query.tags || [];
      setFormData({
        name: album.name,
        queryType: album.query.type,
        tags: tags.join(', '),
        users: album.query.users?.accts?.join(', ') || '',
        tagmode: album.query.tagmode,
        limit: album.query.limit,
        intervalMs: album.refresh.intervalMs,
        enabled: album.enabled,
      });
      setTagChips(tags);
    }
  }, [album]);

  // Handle adding a tag chip
  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = tagInput.trim().replace(/^#/, '');
      if (tag && !tagChips.includes(tag)) {
        setTagChips([...tagChips, tag]);
        setTagInput('');
        setValidationError(null);
      }
    }
  };

  // Handle removing a tag chip
  const handleRemoveTag = (tagToRemove: string) => {
    setTagChips(tagChips.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate form
    if (!formData.name.trim()) {
      setValidationError('Album name is required');
      return;
    }

    // Use tag chips instead of parsing comma-separated
    const tags = tagChips;

    const users = formData.users
      .split(',')
      .map(u => u.trim())
      .filter(Boolean);

    // Validate based on query type
    if (formData.queryType === 'tag' && tags.length === 0) {
      setValidationError('At least one tag is required for tag-based albums');
      return;
    }

    if (formData.queryType === 'user' && users.length === 0) {
      setValidationError('At least one user is required for user-based albums');
      return;
    }

    if (formData.queryType === 'compound' && (tags.length === 0 || users.length === 0)) {
      setValidationError('Both tags and users are required for compound albums');
      return;
    }

    // Build request data
    const requestData: CreateAlbumRequest = {
      name: formData.name.trim(),
      query: {
        type: formData.queryType,
        tagmode: formData.tagmode,
        limit: formData.limit,
      },
      refresh: {
        intervalMs: formData.intervalMs,
      },
      enabled: formData.enabled,
    };

    // Add tags if applicable
    if (formData.queryType === 'tag' || formData.queryType === 'compound') {
      requestData.query.tags = tags;
    }

    // Add users if applicable
    if (formData.queryType === 'user' || formData.queryType === 'compound') {
      requestData.query.users = { accts: users };
    }

    try {
      setIsSaving(true);
      await onSave(requestData);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Failed to save album');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValidationError(null);
  };

  return (
    <div className="album-form-overlay">
      <div className="album-form-container">
        <div className="album-form-header">
          <h2>{album ? 'Edit Album' : 'Create New Album'}</h2>
          <button className="close-button" onClick={onCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="album-form">
          {validationError && (
            <div className="validation-error">
              {validationError}
            </div>
          )}

          {/* Album Name */}
          <div className="form-group">
            <label htmlFor="name">
              Album Name <span className="required">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="My Photo Collection"
              required
            />
          </div>

          {/* Query Type */}
          <div className="form-group">
            <label htmlFor="queryType">
              Query Type <span className="required">*</span>
            </label>
            <select
              id="queryType"
              value={formData.queryType}
              onChange={(e) => handleInputChange('queryType', e.target.value as any)}
            >
              <option value="tag">By Tags</option>
              <option value="user">By Users</option>
              <option value="compound">By Tags AND Users</option>
            </select>
            <small className="help-text">
              {formData.queryType === 'tag' && 'Album will include photos with the specified tags'}
              {formData.queryType === 'user' && 'Album will include photos from the specified users'}
              {formData.queryType === 'compound' && 'Album will include photos from specified users with specified tags'}
            </small>
          </div>

          {/* Tags */}
          {(formData.queryType === 'tag' || formData.queryType === 'compound') && (
            <div className="form-group">
              <label htmlFor="tags">
                Tags <span className="required">*</span>
              </label>
              <div className="tag-chips-container">
                {tagChips.map(tag => (
                  <div key={tag} className="tag-chip">
                    <span>#{tag}</span>
                    <button
                      type="button"
                      className="tag-chip-remove"
                      onClick={() => handleRemoveTag(tag)}
                      aria-label={`Remove ${tag}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <input
                  type="text"
                  id="tags"
                  className="tag-input"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder={tagChips.length === 0 ? "Type a tag and press Enter" : "Add another..."}
                />
              </div>
              <small className="help-text">
                Type a tag (without #) and press Enter or comma to add
              </small>
            </div>
          )}

          {/* Tag Mode */}
          {(formData.queryType === 'tag' || formData.queryType === 'compound') && (
            <div className="form-group">
              <label htmlFor="tagmode">Tag Match Mode</label>
              <select
                id="tagmode"
                value={formData.tagmode}
                onChange={(e) => handleInputChange('tagmode', e.target.value as any)}
              >
                <option value="any">Any (OR) - Match any tag</option>
                <option value="all">All (AND) - Match all tags</option>
              </select>
            </div>
          )}

          {/* Users */}
          {(formData.queryType === 'user' || formData.queryType === 'compound') && (
            <div className="form-group">
              <label htmlFor="users">
                Users <span className="required">*</span>
              </label>
              <input
                type="text"
                id="users"
                value={formData.users}
                onChange={(e) => handleInputChange('users', e.target.value)}
                placeholder="@user@pixelfed.social, @another@mastodon.social"
              />
              <small className="help-text">
                Comma-separated list of user handles (e.g., @username@instance.com)
              </small>
            </div>
          )}

          {/* Limit */}
          <div className="form-group">
            <label htmlFor="limit">Photo Limit</label>
            <input
              type="number"
              id="limit"
              value={formData.limit}
              onChange={(e) => handleInputChange('limit', parseInt(e.target.value) || 20)}
              min="1"
              max="40"
            />
            <small className="help-text">
              Maximum number of photos to fetch per refresh (1-40)
            </small>
          </div>

          {/* Refresh Interval */}
          <div className="form-group">
            <label htmlFor="intervalMs">Refresh Interval</label>
            <select
              id="intervalMs"
              value={formData.intervalMs}
              onChange={(e) => handleInputChange('intervalMs', parseInt(e.target.value))}
            >
              <option value={300000}>5 minutes</option>
              <option value={600000}>10 minutes</option>
              <option value={1800000}>30 minutes</option>
              <option value={3600000}>1 hour</option>
              <option value={21600000}>6 hours</option>
              <option value={86400000}>24 hours</option>
            </select>
            <small className="help-text">
              How often to automatically refresh this album
            </small>
          </div>

          {/* Enabled */}
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => handleInputChange('enabled', e.target.checked)}
              />
              <span>Enable this album</span>
            </label>
            <small className="help-text">
              Disabled albums won't automatically refresh
            </small>
          </div>

          {/* Action Buttons */}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-cancel"
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : album ? 'Update Album' : 'Create Album'}
            </button>
          </div>
        </form>

        <style>{`
          .album-form-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .album-form-container {
            background: white;
            border-radius: 12px;
            max-width: 600px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          }

          .album-form-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid #e0e0e0;
            position: sticky;
            top: 0;
            background: white;
            z-index: 1;
          }

          .album-form-header h2 {
            margin: 0;
            font-size: 1.5rem;
            color: #333;
          }

          .close-button {
            background: none;
            border: none;
            font-size: 2rem;
            color: #999;
            cursor: pointer;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.2s;
          }

          .close-button:hover {
            background: #f0f0f0;
            color: #333;
          }

          .album-form {
            padding: 24px;
          }

          .validation-error {
            padding: 12px 16px;
            background: #ffebee;
            border: 1px solid #ef5350;
            border-radius: 6px;
            color: #c62828;
            margin-bottom: 20px;
            font-size: 0.875rem;
          }

          .form-group {
            margin-bottom: 20px;
          }

          .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #333;
            font-size: 0.9rem;
          }

          .required {
            color: #f44336;
          }

          .form-group input[type="text"],
          .form-group input[type="number"],
          .form-group select {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 0.95rem;
            transition: border-color 0.2s;
            box-sizing: border-box;
          }

          .form-group input:focus,
          .form-group select:focus {
            outline: none;
            border-color: #2196F3;
            box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
          }

          .help-text {
            display: block;
            margin-top: 6px;
            font-size: 0.8rem;
            color: #666;
          }

          .checkbox-group label {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            font-weight: normal;
          }

          .checkbox-group input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
          }

          .tag-chips-container {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 6px;
            min-height: 45px;
            align-items: center;
            background: white;
          }

          .tag-chips-container:focus-within {
            border-color: #2196F3;
            box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
          }

          .tag-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 8px 4px 10px;
            background: #2196F3;
            color: white;
            border-radius: 16px;
            font-size: 0.875rem;
            font-weight: 500;
          }

          .tag-chip-remove {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 1.25rem;
            line-height: 1;
            padding: 0;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background 0.2s;
          }

          .tag-chip-remove:hover {
            background: rgba(255, 255, 255, 0.2);
          }

          .tag-input {
            flex: 1;
            min-width: 120px;
            border: none;
            outline: none;
            padding: 4px;
            font-size: 0.95rem;
          }

          .tag-input::placeholder {
            color: #999;
          }

          .form-actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
          }

          .btn {
            padding: 10px 24px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.95rem;
            font-weight: 500;
            transition: all 0.2s;
          }

          .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .btn-cancel {
            background: #f0f0f0;
            color: #333;
          }

          .btn-cancel:hover:not(:disabled) {
            background: #e0e0e0;
          }

          .btn-primary {
            background: #2196F3;
            color: white;
          }

          .btn-primary:hover:not(:disabled) {
            background: #1976D2;
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(33, 150, 243, 0.4);
          }
        `}</style>
      </div>
    </div>
  );
};

export default AlbumForm;

