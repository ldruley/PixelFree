// Authentication service for Pixelfed OAuth integration
// Connects to the PixelFree backend auth endpoints

export interface AuthStatus {
  isAuthenticated: boolean;
  user?: {
    id?: string;
    username?: string;
    acct?: string;
    display_name?: string;
    avatar?: string;
    header?: string;
    note?: string;
    url?: string;
    followers_count?: number;
    following_count?: number;
    statuses_count?: number;
    created_at?: string;
  };
}

export interface LoginResponse {
  loginUrl: string;
}

// Import centralized API configuration
import { API_CONFIG } from '../config';

/**
 * Check current authentication status
 */
export const checkAuthStatus = async (): Promise<AuthStatus> => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/auth/status`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to check auth status:', error);
    return { isAuthenticated: false };
  }
};

/**
 * Get Pixelfed OAuth login URL
 */
export const getLoginUrl = async (): Promise<string> => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/login`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data: LoginResponse = await response.json();
    return data.loginUrl;
  } catch (error) {
    console.error('Failed to get login URL:', error);
    throw new Error('Unable to initiate login. Please try again.');
  }
};

/**
 * Logout user
 */
export const logout = async (): Promise<void> => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Failed to logout:', error);
    throw new Error('Logout failed. Please try again.');
  }
};

/**
 * Initiate Pixelfed OAuth login
 * Redirects user to Pixelfed for authentication
 */
export const initiateLogin = async (): Promise<void> => {
  try {
    const loginUrl = await getLoginUrl();
    // Redirect to Pixelfed OAuth
    window.location.href = loginUrl;
  } catch (error) {
    console.error('Login initiation failed:', error);
    throw error;
  }
};
