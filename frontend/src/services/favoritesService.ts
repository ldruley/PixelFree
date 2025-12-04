// Favorites service for managing favorite photos
// Connects to the backend favorites APIs

export interface FavoritePhoto {
  id: string;
  created_at: string;
  author?: {
    username?: string;
    avatar?: string;
  };
  author_display_name?: string;
  caption?: string;
  content?: string;
  post_url?: string;
  status_url?: string;
  tags?: string[];
  url: string;
  preview_url?: string;
  location?: string | object;
  favorite_note?: string;
  favorited_at?: string;
}

export interface FavoriteStatus {
  statusId: string;
  is_favorited: boolean;
  favorited_at?: string;
  note?: string;
}

export interface FavoritesListResponse {
  items: FavoritePhoto[];
  total: number;
  offset: number;
  limit: number;
}

// Import centralized API configuration
import { API_CONFIG } from '../config';

/**
 * Add a photo to favorites
 */
export const addFavorite = async (statusId: string, note?: string): Promise<FavoriteStatus> => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/favorites/${statusId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ note }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to add favorite:', error);
    if (error instanceof Error) throw error;
    throw new Error('Unable to add favorite. Please try again.');
  }
};

/**
 * Remove a photo from favorites
 */
export const removeFavorite = async (statusId: string): Promise<void> => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/favorites/${statusId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok && response.status !== 204) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Failed to remove favorite:', error);
    if (error instanceof Error) throw error;
    throw new Error('Unable to remove favorite. Please try again.');
  }
};

/**
 * Get favorite status for a single photo
 */
export const getFavoriteStatus = async (statusId: string): Promise<FavoriteStatus> => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/favorites/${statusId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get favorite status:', error);
    throw new Error('Unable to check favorite status. Please try again.');
  }
};

/**
 * Check favorite status for multiple photos (batch)
 */
export const batchCheckFavorites = async (statusIds: string[]): Promise<Record<string, boolean>> => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/favorites/batch/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ statusIds }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.favorites || {};
  } catch (error) {
    console.error('Failed to batch check favorites:', error);
    return {};
  }
};

/**
 * List all favorited photos with pagination
 */
export const listFavorites = async (options: {
  offset?: number;
  limit?: number;
} = {}): Promise<FavoritesListResponse> => {
  try {
    const params = new URLSearchParams();
    if (options.offset != null) params.set('offset', String(options.offset));
    if (options.limit != null) params.set('limit', String(options.limit));

    const response = await fetch(`${API_CONFIG.BASE_URL}/api/favorites?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to list favorites:', error);
    throw new Error('Unable to fetch favorites. Please try again.');
  }
};

/**
 * Toggle favorite status (convenience method)
 */
export const toggleFavorite = async (statusId: string, isFavorited: boolean): Promise<void> => {
  if (isFavorited) {
    await removeFavorite(statusId);
  } else {
    await addFavorite(statusId);
  }
};

