/**
 * Authentication Context
 * Global state management for authentication
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  checkAuth, 
  logout as authLogout, 
  createSession, 
  validateCredentials,
  validateGoogleToken,
  createGoogleSession
} from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    const auth = checkAuth();
    if (auth) {
      setUser(auth);
    }
    setLoading(false);
  }, []);

  /**
   * Login user
   */
  const login = async (username, password, rememberMe = false) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    if (validateCredentials(username, password)) {
      const session = createSession(username, rememberMe);
      setUser(session);
      return { success: true, user: session };
    }

    return { success: false, error: 'Invalid username or password' };
  };

  /**
   * Logout user
   */
  const logout = () => {
    authLogout();
    setUser(null);
  };

  /**
   * Login with Google
   */
  const loginWithGoogle = async (credential, rememberMe = false) => {
    try {
      const result = await validateGoogleToken(credential);
      if (result.valid) {
        const session = createGoogleSession(result.user, rememberMe);
        setUser(session);
        return { success: true, user: session };
      }
      return { success: false, error: 'Invalid Google credentials' };
    } catch (error) {
      console.error('Google login error:', error);
      return { success: false, error: 'Google login failed' };
    }
  };
  /**
   * Check if user is authenticated
   */
  const isAuthenticated = () => {
    return user !== null;
  };

  const value = {
    user,
    loading,
    login,
    loginWithGoogle,
    logout,
    isAuthenticated
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
