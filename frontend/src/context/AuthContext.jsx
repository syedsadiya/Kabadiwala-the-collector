import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('kc_token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.me(token)
      .then(({ user }) => setUser(user))
      .catch(() => { setToken(null); localStorage.removeItem('kc_token'); })
      .finally(() => setLoading(false));
  }, [token]);

  function loginSuccess({ token, user }) {
    localStorage.setItem('kc_token', token);
    setToken(token);
    setUser(user);
  }

  function logout() {
    localStorage.removeItem('kc_token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, loginSuccess, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
