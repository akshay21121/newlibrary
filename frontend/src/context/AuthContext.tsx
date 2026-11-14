import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { Admin } from '../types/index.js';

interface AuthContextType {
  admin: Admin | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  login: (token: string, adminData: Admin) => void;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('library_admin_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(true);

  const checkAuthStatus = async () => {
    try {
      const statusRes = await api.get('/auth/status');
      setIsConfigured(statusRes.data.isConfigured);

      const savedToken = localStorage.getItem('library_admin_token');
      if (savedToken) {
        try {
          const meRes = await api.get('/auth/me');
          setAdmin(meRes.data.admin);
          setToken(savedToken);
        } catch (err) {
          localStorage.removeItem('library_admin_token');
          localStorage.removeItem('library_admin_user');
          setAdmin(null);
          setToken(null);
        }
      }
    } catch (err) {
      console.error('Failed to check auth status', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const login = (newToken: string, adminData: Admin) => {
    localStorage.setItem('library_admin_token', newToken);
    localStorage.setItem('library_admin_user', JSON.stringify(adminData));
    setToken(newToken);
    setAdmin(adminData);
    setIsConfigured(true);
  };

  const logout = async () => {
    try {
      if (token) {
        await api.post('/auth/logout');
      }
    } catch (err) {
      // Ignore error on logout
    } finally {
      localStorage.removeItem('library_admin_token');
      localStorage.removeItem('library_admin_user');
      setToken(null);
      setAdmin(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        token,
        isAuthenticated: !!token && !!admin,
        isLoading,
        isConfigured,
        login,
        logout,
        checkAuthStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

