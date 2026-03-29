import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import ProjectModal from '../components/ProjectModal';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { refreshProjects } = useOutletContext();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = () => {
    setLoading(true);
    api.projects.list()
      .then(setProjects)
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter);

  const totalProgress = projects.length
    ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)
    : 0;

  const stats = [
    { icon: '📁', label: 'Proyectos Total', value: projects.length, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
    { icon: '🟢', label: 'Activos', value: projects.filter(p => p.status === 'active').length, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { icon: '📊', label: 'Progreso General', value: `${totalProgress}%`, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    { icon: '✅', label: 'Completados', value: projects.filter(p => p.status === 'done').length, color: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
  ];

  const statusColors = { active: '#10b981', backlog: '#64748b', paused: '#f59e0b', done: '#6366f1' };
  const statusLabels = { active: 'Activo', backlog: 'Pendiente', paused: 'Pausado', done: 'Completado' };

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="topbar-title">Dashboard 📊</div>
          <div className="topbar-sub">Hola {user?.name} — {new Date().toLocaleDateString('es', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        {user?.role === 'host' && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Nuevo Proyecto
          </button>
        )}
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="grid-4 mb-20">
          {stats.map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
              <div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Overall progress */}
        <div className="card mb-20">
          <div className="flex items-center justify-between mb-12">
            <div>
              <div className="font-bold" style={{ fontSize: 16 }}>Progreso General de todos los Proyectos</div>
              <div className="text-muted text-sm mt-4">Promedio combinado de avance</div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: totalProgress > 66 ? '#10b981' : totalProgress > 33 ? '#f59e0b' : '#6366f1' }}>
              {totalProgress}%
            </div>
          </div>
          <div className="progress-wrap" style={{ height: 10 }}>
            <div
              className="progress-fill"
              style={{
                width: `${totalProgress}%`,
                background: `linear-gradient(90deg, #6366f1, #ec4899)`,
              }}
            />
          </div>
          {/* Mini bars per project */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {projects.map(p => (
              <div key={p.id} className="flex items-center gap-8" onClick={() => navigate(`/project/${p.id}`)} style={{ cursor: 'pointer' }}>
                <span style={{ fontSize: 14, width: 22 }}>{p.icon}</span>
                <span style={{ fontSize: 12, color: 'var(--text2)', width: 180, flexShrink: 0 }} className="truncate">{p.name}</span>
                <div className="progress-wrap flex-1">
                  <div className="progress-fill" style={{ width: `${p.progress}%`, background: p.color }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text3)', width: 32, textAlign: 'right' }}>{p.progress}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center justify-between mb-16">
          <div style={{ display: 'flex', gap: 8 }}>
            {['all', 'active', 'backlog', 'paused', 'done'].map(f => (
              <button
                key={f}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'Todos' : statusLabels[f]}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{filtered.length} proyecto(s)</span>
        </div>

        {/* Projects grid */}
        {loading ? (
          <div className="flex justify-center" style={{ padding: 60 }}><div className="loader" /></div>
        ) : (
          <div className="grid-3">
            {filtered.map(p => (
              <div
                key={p.id}
                className="project-card"
                onClick={() => navigate(`/project/${p.id}`)}
                style={{ borderTopColor: p.color }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: p.color, borderRadius: '12px 12px 0 0' }} />
                <div className="proj-icon">{p.icon}</div>
                <div className="proj-name">{p.name}</div>
                <div className="proj-desc">{p.description}</div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  <span className={`badge badge-${p.status}`}>{statusLabels[p.status] || p.status}</span>
                  {p.category && <span className="tag">{p.category}</span>}
                </div>

                <div className="proj-progress-label">
                  <span>Progreso</span>
                  <span style={{ fontWeight: 600, color: p.color }}>{p.progress}%</span>
                </div>
                <div className="progress-wrap">
                  <div className="progress-fill" style={{ width: `${p.progress}%`, background: p.color }} />
                </div>

                <div className="flex gap-12 mt-12" style={{ fontSize: 12, color: 'var(--text3)' }}>
                  <span>👥 {p.member_count}</span>
                  <span>✅ {p.done_tasks}/{p.total_tasks} tareas</span>
                  <span>💬 {p.comment_count}</span>
                </div>
              </div>
            ))}

            {user?.role === 'host' && (
              <div
                className="project-card"
                onClick={() => setShowCreate(true)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--border)', cursor: 'pointer', minHeight: 200 }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>+</div>
                <div style={{ color: 'var(--text3)', fontSize: 13 }}>Nuevo Proyecto</div>
              </div>
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <ProjectModal
          onClose={() => setShowCreate(false)}
          onSave={async (data) => {
            try {
              await api.projects.create(data);
              toast('Proyecto creado', 'success');
              load();
              refreshProjects();
              setShowCreate(false);
            } catch (e) {
              toast(e.message, 'error');
            }
          }}
        />
      )}
    </div>
  );
}
