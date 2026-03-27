/**
 * AuthContext - Premium authentication with JWT
 */
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const token = localStorage.getItem('cf_token');
    const savedUser = localStorage.getItem('cf_user');
    const savedOrg = localStorage.getItem('cf_org');

    if (token && savedUser && savedOrg) {
      setUser(JSON.parse(savedUser));
      setOrganization(JSON.parse(savedOrg));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Save to localStorage
      localStorage.setItem('cf_token', data.token);
      localStorage.setItem('cf_user', JSON.stringify(data.user));
      localStorage.setItem('cf_org', JSON.stringify(data.organization));

      setUser(data.user);
      setOrganization(data.organization);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signup = async (formData) => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      // Auto-login after signup
      localStorage.setItem('cf_token', data.token);
      localStorage.setItem('cf_user', JSON.stringify(data.user));
      localStorage.setItem('cf_org', JSON.stringify(data.organization));

      setUser(data.user);
      setOrganization(data.organization);

      return { success: true, organization: data.organization };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('cf_token');
    localStorage.removeItem('cf_user');
    localStorage.removeItem('cf_org');
    setUser(null);
    setOrganization(null);
  };

  const updateOrganization = async (updates) => {
    try {
      const token = localStorage.getItem('cf_token');
      const response = await fetch('/api/organizations/settings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Update failed');
      }

      const updatedOrg = data.organization;
      localStorage.setItem('cf_org', JSON.stringify(updatedOrg));
      setOrganization(updatedOrg);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    organization,
    loading,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
    updateOrganization,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
