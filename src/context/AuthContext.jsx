import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import { normalizeRole } from '../utils/permissions';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('sfcc_user');
    const token = localStorage.getItem('sfcc_token');
    if (stored && token) {
      const parsedUser = JSON.parse(stored);
      setUser({ ...parsedUser, role: normalizeRole(parsedUser?.role) });
    }
    setLoading(false);
  }, []);

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('sfcc_token', data.token);
    const normalizedUser = { ...data.user, role: normalizeRole(data.user?.role) };
    localStorage.setItem('sfcc_user', JSON.stringify(normalizedUser));
    setUser(normalizedUser);
    return normalizedUser;
  }

  function logout() {
    localStorage.removeItem('sfcc_token');
    localStorage.removeItem('sfcc_user');
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
