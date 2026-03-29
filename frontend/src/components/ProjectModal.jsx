import React, { useState } from 'react';

const ICONS = ['🚀','📈','📓','🪙','🤖','⚙️','🏢','💡','🎯','📱','🌐','💰','🔥','⚡','🎨','📊','🛠️','🧠'];
const COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ea580c','#14b8a6','#1a73e8','#0891b2','#16a34a','#dc2626'];

export default function ProjectModal({ project, onClose, onSave }) {
  const [form, setForm] = useState({
    name: project?.name || '',
    description: project?.description || '',
    color: project?.color || '#6366f1',
    icon: project?.icon || '🚀',
    category: project?.category || '',
    status: project?.status || 'active',
    progress: project?.progress ?? 0,
  });
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handle = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{project ? '✏️ Editar Proyecto' : '✨ Nuevo Proyecto'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handle}>
          <div className="form-group">
            <label className="label">Nombre del Proyecto</label>
            <input className="input" placeholder="Ej: Copy Trading" value={form.name} onChange={set('name')} required />
          </div>

          <div className="form-group">
            <label className="label">Descripción</label>
            <textarea className="input" placeholder="¿De qué trata este proyecto?" value={form.description} onChange={set('description')} />
          </div>

          <div className="flex gap-12">
            <div className="form-group flex-1">
              <label className="label">Categoría</label>
              <input className="input" placeholder="Trading, Marketing..." value={form.category} onChange={set('category')} />
            </div>
            <div className="form-group flex-1">
              <label className="label">Estado</label>
              <select className="input" value={form.status} onChange={set('status')}>
                <option value="active">Activo</option>
                <option value="backlog">Pendiente</option>
                <option value="paused">Pausado</option>
                <option value="done">Completado</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Progreso ({form.progress}%)</label>
            <input type="range" min={0} max={100} value={form.progress} onChange={set('progress')}
              style={{ width: '100%', accentColor: form.color }} />
          </div>

          <div className="form-group">
            <label className="label">Ícono</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ICONS.map(icon => (
                <button key={icon} type="button"
                  onClick={() => setForm(f => ({ ...f, icon }))}
                  style={{
                    width: 36, height: 36, borderRadius: 8, border: `2px solid ${form.icon === icon ? form.color : 'var(--border)'}`,
                    background: form.icon === icon ? `${form.color}22` : 'var(--bg3)',
                    cursor: 'pointer', fontSize: 18
                  }}
                >{icon}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="label">Color</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {COLORS.map(c => (
                <button key={c} type="button"
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: c,
                    border: `3px solid ${form.color === c ? '#fff' : 'transparent'}`,
                    cursor: 'pointer', outline: form.color === c ? `2px solid ${c}` : 'none'
                  }}
                />
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '...' : project ? 'Guardar Cambios' : 'Crear Proyecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
