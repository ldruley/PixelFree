import React, { useState, useEffect, useMemo } from 'react';
import { useCombobox } from 'downshift';
import type { Album, CreateAlbumRequest } from '../services/albumService';
import { getTagSuggestions } from '../utils/commonTags';
import { wordDictionary } from '../utils/wordDictionary';
import '../styles/AppLayout.css';

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
  
  // Get hybrid tag suggestions (curated + dictionary)
  const { suggestions, curatedCount } = useMemo(() => {
    if (!tagInput.trim()) return { suggestions: [], curatedCount: 0 };
    
    // Get curated photography tags (prioritized)
    const curatedTags = getTagSuggestions(tagInput, tagChips);
    
    // Get additional words from trie dictionary
    const searchTerm = tagInput.toLowerCase().trim().replace(/^#/, '');
    const dictionaryWords = wordDictionary.search(searchTerm)
      .filter(word => !tagChips.includes(word)) // Exclude already added
      .filter(word => !curatedTags.includes(word)); // Exclude duplicates from curated
    
    // Combine: curated tags first (max 10), then dictionary words (remaining slots)
    const maxCurated = 10;
    const maxTotal = 20;
    const topCurated = curatedTags.slice(0, maxCurated);
    const remainingSlots = maxTotal - topCurated.length;
    const additionalWords = dictionaryWords.slice(0, remainingSlots);
    
    return {
      suggestions: [...topCurated, ...additionalWords],
      curatedCount: topCurated.length,
    };
  }, [tagInput, tagChips]);
  
  // Downshift combobox for autocomplete
  const {
    isOpen,
    getMenuProps,
    getInputProps,
    highlightedIndex,
    getItemProps,
    reset,
  } = useCombobox({
    items: suggestions,
    inputValue: tagInput,
    onInputValueChange: ({ inputValue }) => {
      setTagInput(inputValue || '');
    },
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem && !tagChips.includes(selectedItem)) {
        setTagChips([...tagChips, selectedItem]);
        setValidationError(null);
        // Clear input and reset combobox
        setTagInput('');
        reset();
      }
    },
    itemToString: (item) => item || '',
  });
  
  // Helper to highlight matching text
  const highlightMatch = (tag: string, search: string) => {
    const searchTerm = search.toLowerCase().trim().replace(/^#/, '');
    const tagLower = tag.toLowerCase();
    const index = tagLower.indexOf(searchTerm);
    
    if (index === -1) return tag;
    
    const before = tag.slice(0, index);
    const match = tag.slice(index, index + searchTerm.length);
    const after = tag.slice(index + searchTerm.length);
    
    return (
      <span>{before}<strong>{match}</strong>{after}</span>
    );
  };

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

  // Handle adding a tag chip manually
  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Don't add on Enter if there are suggestions (let Downshift handle it)
    if (e.key === 'Enter' && suggestions.length > 0) {
      return;
    }
    
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
          <div className="form-group form-group-full">
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
            <div className="form-group form-group-full">
              <label htmlFor="tags">
                Tags <span className="required">*</span>
              </label>
              <div className="tag-autocomplete-wrapper">
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
                    {...getInputProps({
                      type: "text",
                      id: "tags",
                      className: "tag-input",
                      placeholder: tagChips.length === 0 ? "Type a tag and press Enter" : "Add another...",
                      onKeyDown: handleAddTag,
                    })}
                  />
                </div>
                
                {/* Autocomplete Dropdown */}
                {isOpen && tagInput.trim() && suggestions.length > 0 && (
                  <ul {...getMenuProps()} className="tag-suggestions">
                    {suggestions.map((item, index) => (
                      <React.Fragment key={item}>
                        {/* Add divider between curated and dictionary suggestions */}
                        {index === curatedCount && curatedCount > 0 && curatedCount < suggestions.length && (
                          <li className="tag-suggestions-divider">
                            <span>More suggestions</span>
                          </li>
                        )}
                        <li
                          {...getItemProps({ item, index })}
                          className={`tag-suggestion-item ${highlightedIndex === index ? 'highlighted' : ''}`}
                        >
                          <span className="suggestion-hash">#</span>
                          {highlightMatch(item, tagInput)}
                        </li>
                      </React.Fragment>
                    ))}
                  </ul>
                )}
              </div>
              <small className="help-text">
                Type to see suggestions, press Enter or comma to add custom tags
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
            <div className="form-group form-group-full">
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
          <div className="form-group form-group-full checkbox-group">
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
      </div>
    </div>
  );
};

export default AlbumForm;

