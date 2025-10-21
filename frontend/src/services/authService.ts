// Authentication service for Pixelfed OAuth integration
// Connects to the PixelFree backend auth endpoints

export interface AuthStatus {
  isAuthenticated: boolean;
  user?: {
    username?: string;
    display_name?: string;
    avatar?: string;
  };
}

export interface LoginResponse {
  loginUrl: string;
}

// Use relative URLs - Vite proxy will handle routing to backend
const API_BASE = '';

/**
 * Check current authentication status
 */
export const checkAuthStatus = async (): Promise<AuthStatus> => {
  try {
    const response = await fetch(`${API_BASE}/api/auth/status`);
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
    const response = await fetch(`${API_BASE}/api/login`);
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
    const response = await fetch(`${API_BASE}/api/auth/logout`, {
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
