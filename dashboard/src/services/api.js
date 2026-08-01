import axios from 'axios';

/**
 * ================================================================
 * API Service
 * ================================================================
 * Centralized Axios instance with interceptors for:
 *   - Base URL configuration
 *   - Auth token injection
 *   - Tenant header injection
 *   - Error response handling
 * ================================================================
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach auth token
api.interceptors.request.use(
  (config) => {
    // TODO: Get token from secure storage
    const session = localStorage.getItem('luevora_session');
    if (session) {
      const { token } = JSON.parse(session);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('luevora_session');
      // Only redirect if not already on the login page to preserve error messages
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
