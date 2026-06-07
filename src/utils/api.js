import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL;

if (!BASE) {
  throw new Error('Missing VITE_API_URL. Set it in frontend/.env (example: http://localhost:5000/api).');
}

const api = axios.create({ baseURL: BASE });

// Attach token automatically
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('sfcc_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Handle 401 globally
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sfcc_token');
      localStorage.removeItem('sfcc_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
