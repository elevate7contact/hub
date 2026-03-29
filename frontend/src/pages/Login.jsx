import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // login | register
  const [form, setForm] = useState({ name: '', email: '', password: '', invite_code: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handle = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form.name, form.email, form.password, form.invite_code);
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-icon">🚀</span>
          <h1 className="gradient-text">HUB</h1>
          <p>Centro de Gestión de Proyectos</p>
        </div>

        <div className="tabs" style={{ marginBottom: 24 }}>
          <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError(''); }}>
            Iniciar Sesión
          </button>
          <button className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError(''); }}>
            Registrarse
          </button>
        </div>

        <form onSubmit={handle}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="label">Nombre</label>
              <input className="input" placeholder="Tu nombre" value={form.name} onChange={set('name')} required />
            </div>
          )}
          <div className="form-group">
            <label className="label">Email</label>
            <input className="input" type="email" placeholder="tu@email.com" value={form.email} onChange={set('email')} required />
          </div>
          <div className="form-group">
            <label className="label">Contraseña</label>
            <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />
          </div>
          {mode === 'register' && (
            <div className="form-group">
              <label className="label">Código de Invitación</label>
              <input className="input" placeholder="XXXXXXXX" value={form.invite_code} onChange={set('invite_code')} required style={{ textTransform: 'uppercase', letterSpacing: 2 }} />
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--red)' }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
            {loading ? <span className="loader" style={{ width: 18, height: 18, borderWidth: 2 }} /> : mode === 'login' ? '→ Entrar' : '✨ Crear cuenta'}
          </button>
        </form>

      </div>
    </div>
  );
}
