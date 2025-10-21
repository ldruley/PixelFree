// Album service for managing virtual albums
// Connects to the backend album APIs

import type { Photo } from './photoService';

export interface Album {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  enabled: boolean;
  query: {
    type: 'tag' | 'user' | 'compound';
    tags?: string[];
    users?: {
      accts?: string[];
      ids?: string[];
    };
    tagmode: 'any' | 'all';
    limit: number;
  };
  refresh: {
    intervalMs: number;
    last_checked_at?: string | null;
    backoff_until?: string | null;
    since_id?: string | null;
    max_id?: string | null;
  };
  stats?: {
    total: number;
    last_added?: string;
  };
}

export interface CreateAlbumRequest {
  name: string;
  query: {
    type: 'tag' | 'user' | 'compound';
    tags?: string[];
    users?: {
      accts?: string[];
      ids?: string[];
    } | string[]; // Accept array of accts as shorthand
    tagmode?: 'any' | 'all';
    limit?: number;
  };
  refresh?: {
    intervalMs?: number;
  };
  enabled?: boolean;
  id?: string; // Optional ID for special albums like favorites
}

export interface UpdateAlbumRequest {
  name?: string;
  query?: Partial<CreateAlbumRequest['query']>;
  refresh?: Partial<Album['refresh']>;
  enabled?: boolean;
}

export interface AlbumListResponse {
  items: Album[];
  total: number;
  offset: number;
  limit: number;
}

const API_BASE = ''; // Use relative URLs - Vite proxy handles routing

/**
 * List all albums
 */
export const listAlbums = async (options: {
  offset?: number;
  limit?: number;
  enabled?: boolean;
} = {}): Promise<AlbumListResponse> => {
  try {
    const params = new URLSearchParams();
    if (options.offset != null) params.set('offset', String(options.offset));
    if (options.limit != null) params.set('limit', String(options.limit));
    if (options.enabled != null) params.set('enabled', String(options.enabled));

    const response = await fetch(`${API_BASE}/api/albums?${params.toString()}`, {
      method: 'GET',
      credentials: 'include', // Include cookies for auth
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to list albums:', error);
    throw new Error('Unable to fetch albums. Please try again.');
  }
};

/**
 * Get a single album by ID
 */
export const getAlbum = async (id: string): Promise<Album> => {
  try {
    const response = await fetch(`${API_BASE}/api/albums/${id}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get album:', error);
    throw new Error('Unable to fetch album. Please try again.');
  }
};

/**
 * Create a new album
 */
export const createAlbum = async (data: CreateAlbumRequest): Promise<Album> => {
  try {
    const response = await fetch(`${API_BASE}/api/albums`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to create album:', error);
    if (error instanceof Error) throw error;
    throw new Error('Unable to create album. Please try again.');
  }
};

/**
 * Update an existing album
 */
export const updateAlbum = async (id: string, data: UpdateAlbumRequest): Promise<Album> => {
  try {
    const response = await fetch(`${API_BASE}/api/albums/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to update album:', error);
    if (error instanceof Error) throw error;
    throw new Error('Unable to update album. Please try again.');
  }
};

/**
 * Delete an album
 */
export const deleteAlbum = async (id: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE}/api/albums/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Failed to delete album:', error);
    throw new Error('Unable to delete album. Please try again.');
  }
};

/**
 * Toggle album enabled/disabled state
 */
export const toggleAlbum = async (id: string, enabled: boolean): Promise<Album> => {
  try {
    const response = await fetch(`${API_BASE}/api/albums/${id}/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ enabled }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to toggle album:', error);
    throw new Error('Unable to toggle album. Please try again.');
  }
};

/**
 * Manually refresh an album (fetch new photos)
 */
export const refreshAlbum = async (id: string): Promise<{
  albumId: string;
  type: string;
  tagmode: string;
  requested: number;
  fetched: number;
  upserted: number;
  linked: number;
}> => {
  try {
    const response = await fetch(`${API_BASE}/api/albums/${id}/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to refresh album:', error);
    throw new Error('Unable to refresh album. Please try again.');
  }
};

/**
 * Get photos in an album
 */
export const getAlbumPhotos = async (
  id: string,
  options: { offset?: number; limit?: number } = {}
): Promise<{ items: Photo[]; total: number; offset: number; limit: number }> => {
  try {
    const params = new URLSearchParams();
    if (options.offset != null) params.set('offset', String(options.offset));
    if (options.limit != null) params.set('limit', String(options.limit));

    const response = await fetch(`${API_BASE}/api/albums/${id}/photos?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get album photos:', error);
    throw new Error('Unable to fetch album photos. Please try again.');
  }
};

