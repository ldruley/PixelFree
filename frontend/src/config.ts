/**
 * Application Configuration
 * Centralized configuration for API endpoints and app settings
 */

export const API_CONFIG = {
  /**
   * Base URL for API calls
   * In development: Uses relative URLs with Vite proxy
   * In production: Can be overridden with environment variable
   */
  BASE_URL: import.meta.env.VITE_API_BASE_URL || '',
} as const;

export const APP_CONFIG = {
  /**
   * Application name
   */
  NAME: 'PixelFree',
  
  /**
   * Environment
   */
  ENV: import.meta.env.MODE,
  
  /**
   * Development mode check
   */
  IS_DEV: import.meta.env.DEV,
  
  /**
   * Production mode check
   */
  IS_PROD: import.meta.env.PROD,
  
  /**
   * Maximum number of photos to load per album
   */
  MAX_ALBUM_PHOTOS: 1000,
} as const;

