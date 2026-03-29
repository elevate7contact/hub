import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    api.projects.list().then(setProjects).catch(() => {});
  }, [location.pathname]);

  const isActive = (path) => location.pathname === path;

  const statusColors = {
    active: '#10b981', backlog: '#64748b', paused: '#f59e0b', done: '#6366f1'
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span style={{ fontSize: 28 }}>🚀</span>
          <div>
            <div className="logo-text gradient-text">HUB</div>
            <div className="logo-sub">Centro de Proyectos</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">General</div>
            <button className={`nav-item ${isActive('/') ? 'active' : ''}`} onClick={() => navigate('/')}>
              <span>📊</span> Dashboard
            </button>
          </div>

          <div className="nav-section">
            <div className="nav-section-title">Proyectos ({projects.length})</div>
            {projects.map(p => (
              <button
                key={p.id}
                className={`nav-item ${location.pathname === `/project/${p.id}` ? 'active' : ''}`}
                onClick={() => navigate(`/project/${p.id}`)}
              >
                <div className="dot" style={{ background: statusColors[p.status] || '#64748b' }} />
                <span className="truncate">{p.icon} {p.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>{p.progress}%</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div
              className="avatar"
              style={{ background: user?.avatar_color || '#6366f1', color: '#fff' }}
            >
              {user?.name?.charAt(0)}
            </div>
            <div className="user-details flex-1">
              <div className="user-name truncate">{user?.name}</div>
              <div className="user-role">{user?.role === 'host' ? '👑 Host' : '👤 Member'}</div>
            </div>
            <button
              onClick={logout}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16 }}
              title="Cerrar sesión"
            >⏻</button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Outlet context={{ refreshProjects: () => api.projects.list().then(setProjects) }} />
      </main>
    </div>
  );
}
