// Photo service for fetching photos from PixelFree backend
// Connects to the backend photo query APIs

export interface Photo {
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
}

export interface PhotoQueryRequest {
  type: 'tag' | 'user' | 'compound';
  tags?: string[];
  tagmode?: 'any' | 'all';
  accts?: string[];
  users?: {
    accts?: string[];
    accountIds?: string[];
  };
  limit?: number;
}

export interface PhotoQueryResponse {
  photos?: Photo[];
  errors?: Array<{
    target: string;
    code: string;
    message: string;
  }>;
}

const API_BASE = ''; // Use relative URLs - Vite proxy handles routing

/**
 * Query photos using the advanced query API
 */
export const queryPhotos = async (query: PhotoQueryRequest): Promise<Photo[]> => {
  try {
    const response = await fetch(`${API_BASE}/api/photos/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Handle both array response and object response with photos/errors
    if (Array.isArray(data)) {
      return data;
    }
    
    if (data && typeof data === 'object' && Array.isArray(data.photos)) {
      // Log any partial errors but still return photos
      if (data.errors && data.errors.length > 0) {
        console.warn('Photo query had partial errors:', data.errors);
      }
      return data.photos;
    }
    
    return [];
  } catch (error) {
    console.error('Failed to query photos:', error);
    throw new Error('Unable to fetch photos. Please try again.');
  }
};

/**
 * Fetch photos by tags only
 */
export const getPhotosByTags = async (
  tags: string[], 
  options: { tagmode?: 'any' | 'all'; limit?: number } = {}
): Promise<Photo[]> => {
  return queryPhotos({
    type: 'tag',
    tags,
    tagmode: options.tagmode || 'any',
    limit: options.limit || 20,
  });
};

/**
 * Fetch photos by users only
 */
export const getPhotosByUsers = async (
  accts: string[], 
  options: { limit?: number } = {}
): Promise<Photo[]> => {
  return queryPhotos({
    type: 'user',
    accts,
    limit: options.limit || 20,
  });
};

/**
 * Fetch photos by both tags and users (compound query)
 */
export const getPhotosByTagsAndUsers = async (
  tags: string[],
  accts: string[],
  options: { tagmode?: 'any' | 'all'; limit?: number } = {}
): Promise<Photo[]> => {
  return queryPhotos({
    type: 'compound',
    tags,
    users: { accts },
    tagmode: options.tagmode || 'any',
    limit: options.limit || 20,
  });
};

/**
 * Get sample photos for demo purposes
 */
export const getSamplePhotos = async (): Promise<Photo[]> => {
  // Fetch some photos with common tags for demo
  try {
    return await getPhotosByTags(['italy', 'travel', 'Syria'], { 
      tagmode: 'any', 
      limit: 12 
    });
  } catch (error) {
    console.error('Failed to get sample photos:', error);
    return [];
  }
};
