import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('library_admin_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle 401s
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't auto-redirect on login or status check calls
      const isAuthUrl = error.config.url?.includes('/auth/login') || error.config.url?.includes('/auth/status');
      if (!isAuthUrl) {
        localStorage.removeItem('library_admin_token');
        localStorage.removeItem('library_admin_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

