import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('hub_token');
    if (token) {
      api.auth.me()
        .then(u => setUser(u))
        .catch(() => localStorage.removeItem('hub_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const { token, user } = await api.auth.login(email, password);
    localStorage.setItem('hub_token', token);
    setUser(user);
    return user;
  };

  const register = async (name, email, password, invite_code) => {
    const { token, user } = await api.auth.register(name, email, password, invite_code);
    localStorage.setItem('hub_token', token);
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('hub_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
