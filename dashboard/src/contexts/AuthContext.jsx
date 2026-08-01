import { createContext, useState, useEffect, useCallback } from 'react';
import api from '@/services/api';

/**
 * ================================================================
 * AuthContext
 * ================================================================
 * Provides authentication state and the tenant's business_type
 * to the entire application. The business_type drives which
 * layout and routes are rendered (Dynamic Layout Resolution).
 * ================================================================
 */
export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [businessType, setBusinessType] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Check for existing session on mount.
   * Calls the backend /api/auth/me endpoint to verify token.
   */
  useEffect(() => {
    const checkAuth = async () => {
      const stored = localStorage.getItem('luevora_session');
      if (!stored) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        if (res.data.status) {
          setUser(res.data.user);
          setBusinessType(res.data.business_type);
        } else {
          localStorage.removeItem('luevora_session');
        }
      } catch (err) {
        console.error('Session validation failed:', err.message);
        localStorage.removeItem('luevora_session');
        setUser(null);
        setBusinessType(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  /**
   * Login handler.
   * Calls the backend, stores session, and sets business_type.
   */
  const login = useCallback(async (credentials) => {
    try {
      const res = await api.post('/auth/login', {
        email: credentials.email,
        password: credentials.password
      });

      if (res.data.status) {
        const { user, token, business_type, tenant } = res.data;

        setUser(user);
        setBusinessType(business_type);
        
        localStorage.setItem('luevora_session', JSON.stringify({
          user,
          token,
          tenant,
          business_type,
        }));

        return { success: true };
      } else {
        return { success: false, message: res.data.message || 'Login gagal' };
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Gagal terhubung ke server';
      return { success: false, message };
    }
  }, []);

  /**
   * Logout handler.
   */
  const logout = useCallback(async () => {
    try {
      // In a real app, you might notify the backend
      // await api.post('/auth/logout');
    } catch {
      // Silent fail
    } finally {
      setUser(null);
      setBusinessType(null);
      localStorage.removeItem('luevora_session');
      window.location.href = '/login';
    }
  }, []);

  const value = {
    user,
    businessType,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;

