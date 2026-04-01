/**
 * Auth Context
 * ============
 * Manages authentication state across the app.
 * Updated: Now properly handles rate limiting errors (429)
 * Updated: Clears welcome message flag on login/logout for dashboard UX
 * Updated: Removed reCAPTCHA - not compatible with private IP
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, getErrorMessage } from '../services/api';

const AuthContext = createContext(null);

// Session storage key for dashboard welcome message
const WELCOME_SHOWN_KEY = 'dashboard_welcome_shown';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is logged in on app load
  useEffect(() => {
    const initAuth = () => {
      try {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('access_token');

        if (storedUser && token) {
          setUser(JSON.parse(storedUser));
        }
      } catch (err) {
        console.error('Error loading auth state:', err);
        localStorage.removeItem('user');
        localStorage.removeItem('access_token');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Login function - updated to include CAPTCHA
  const login = useCallback(async (username, password, captchaToken, captchaAnswer) => {
    setError(null);
    try {
      const data = await authAPI.login(username, password, captchaToken, captchaAnswer);
      
      // Clear the welcome shown flag so it shows on new login
      sessionStorage.removeItem(WELCOME_SHOWN_KEY);
      
      setUser(data.user);
      return data;
    } catch (err) {
      // Use the getErrorMessage helper for proper error extraction
      // This handles rate limiting (429) and other errors properly
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Signup function - updated to include CAPTCHA
  const signup = useCallback(async (userData, captchaToken, captchaAnswer) => {
    setError(null);
    try {
      const data = await authAPI.signup(userData, captchaToken, captchaAnswer);
      return data;
    } catch (err) {
      // Use the getErrorMessage helper for proper error extraction
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } finally {
      // Clear session data including welcome flag
      sessionStorage.removeItem(WELCOME_SHOWN_KEY);
      
      setUser(null);
      setError(null);
    }
  }, []);

  const isAdmin = useCallback(() => {
    return ['admin', 'superadmin'].includes(user?.role);
  }, [user]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = {
    user,
    loading,
    error,
    login,
    signup,
    logout,
    isAdmin,
    clearError,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}