import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { checkAuthStatus, logout as logoutService } from '../services/authService';
import type { AuthStatus } from '../services/authService';

interface AuthContextType {
  authStatus: AuthStatus;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isAuthenticated: false });
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuthStatus = async () => {
    try {
      setIsLoading(true);
      const status = await checkAuthStatus();
      setAuthStatus(status);
    } catch (error) {
      console.error('Failed to refresh auth status:', error);
      setAuthStatus({ isAuthenticated: false });
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    // Import dynamically to avoid circular dependencies
    const { initiateLogin } = await import('../services/authService');
    await initiateLogin();
  };

  const logout = async () => {
    try {
      await logoutService();
      setAuthStatus({ isAuthenticated: false });
    } catch (error) {
      console.error('Logout failed:', error);
      // Still update local state even if logout request failed
      setAuthStatus({ isAuthenticated: false });
      throw error;
    }
  };

  // Check auth status on mount and when returning from OAuth
  useEffect(() => {
    refreshAuthStatus();

    // Listen for focus events (user returning from OAuth)
    const handleFocus = () => {
      refreshAuthStatus();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const value: AuthContextType = {
    authStatus,
    isLoading,
    login,
    logout,
    refreshAuthStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
