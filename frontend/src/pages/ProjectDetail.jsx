import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import ProjectModal from '../components/ProjectModal';

const statusLabels = { active: 'Activo', backlog: 'Pendiente', paused: 'Pausado', done: 'Completado' };

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return 'ahora';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function makeId() {
  return Math.random().toString(36).substring(2, 10);
}

function TaskItem({ task, projectId, onUpdate, onDelete, isOwner }) {
  const [expanded, setExpanded] = useState(false);
  const [newStep, setNewStep] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const steps = task.steps || [];
  const progress = task.progress || 0;
  const doneSteps = steps.filter(s => s.done).length;
  const isDone = steps.length > 0 ? progress === 100 : task.status === 'done';

  const updateSteps = async (updatedSteps) => {
    setSaving(true);
    try {
      await api.tasks.update(projectId, task.id, { steps: updatedSteps });
      onUpdate();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const toggleStep = (stepId) => {
    updateSteps(steps.map(s => s.id === stepId ? { ...s, done: !s.done } : s));
  };

  const addStep = (e) => {
    if (e.key === 'Enter' && newStep.trim()) {
      updateSteps([...steps, { id: makeId(), title: newStep.trim(), done: false }]);
      setNewStep('');
    }
  };

  const deleteStep = (stepId) => updateSteps(steps.filter(s => s.id !== stepId));

  const toggleDone = async () => {
    if (steps.length > 0) return;
    const next = task.status === 'done' ? 'pending' : 'done';
    setSaving(true);
    try { await api.tasks.update(projectId, task.id, { status: next }); onUpdate(); }
    catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <div className="task-item" style={{ alignItems: 'flex-start', gap: 10 }}>
        {/* ▶ siempre visible para expandir y agregar pasos */}
        <button onClick={() => setExpanded(e => !e)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 11, padding: '3px 0', minWidth: 16, marginTop: 2 }}>
          {expanded ? '▼' : '▶'}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`task-title ${isDone ? 'done' : ''}`} style={{ flex: 1 }}>{task.title}</span>
            <span className={`badge priority-${task.priority}`} style={{ fontSize: 10 }}>{task.priority}</span>
            {/* Checkbox solo cuando no tiene pasos */}
            {steps.length === 0 && (
              <button
                className={`task-check ${isDone ? 'done' : ''}`}
                onClick={toggleDone} disabled={saving}
                title={isDone ? 'Marcar pendiente' : 'Marcar como lista'}>
                {isDone && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
              </button>
            )}
            {isOwner && <button onClick={() => onDelete(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, padding: '0 2px' }}>×</button>}
          </div>
          {steps.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
              <div style={{ flex: 1, height: 4, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#10b981' : '#6366f1', transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 52 }}>{doneSteps}/{steps.length} · {progress}%</span>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ marginLeft: 26, marginTop: 4, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
          {task.description && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>{task.description}</div>}
          {steps.map(step => (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <input type="checkbox" checked={step.done} onChange={() => toggleStep(step.id)} disabled={saving}
                style={{ cursor: 'pointer', accentColor: '#6366f1', width: 15, height: 15 }} />
              <span style={{ flex: 1, fontSize: 13, color: step.done ? 'var(--text3)' : 'var(--text1)', textDecoration: step.done ? 'line-through' : 'none' }}>{step.title}</span>
              <button onClick={() => deleteStep(step.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 12 }}>×</button>
            </div>
          ))}
          <input className="input" placeholder="+ Agregar paso (Enter)" value={newStep}
            onChange={e => setNewStep(e.target.value)} onKeyDown={addStep}
            style={{ fontSize: 12, padding: '6px 10px', marginTop: 4 }} />
        </div>
      )}
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { refreshProjects } = useOutletContext();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [showEdit, setShowEdit] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [newComment, setNewComment] = useState('');
  const [newFile, setNewFile] = useState({ name: '', url: '', file_type: 'link' });
  const [showFileForm, setShowFileForm] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiContext, setAiContext] = useState('');
  const [editingContext, setEditingContext] = useState(false);
  const aiEndRef = useRef(null);

  const load = () => {
    setLoading(true);
    api.projects.get(id)
      .then(p => {
        setProject(p);
        setAiContext(p.ai_context || '');
        if (aiMessages.length === 0) {
          setAiMessages([{ role: 'assistant', content: `¡Hola! Soy tu asistente para **${p.name}**. Progreso actual: ${p.progress}%. ¿En qué puedo ayudarte?` }]);
        }
      })
      .catch(e => { toast(e.message, 'error'); navigate('/'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => { aiEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiMessages]);
  useEffect(() => { if (tab === 'team') api.workspace.members().then(setWorkspaceMembers).catch(() => {}); }, [tab]);

  const isOwner = project?.owner_id === user?.id || user?.role === 'host';
  const projectMemberIds = new Set(project?.members?.map(m => m.id) || []);
  const notInProject = workspaceMembers.filter(m => !projectMemberIds.has(m.id));

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    try { await api.tasks.create(id, { title: newTask, priority: taskPriority }); setNewTask(''); load(); refreshProjects(); toast('Tarea agregada', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  };

  const deleteTask = async (taskId) => {
    try { await api.tasks.delete(id, taskId); load(); refreshProjects(); toast('Tarea eliminada', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try { await api.comments.create(id, newComment); setNewComment(''); load(); toast('Comentario agregado', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  };

  const addFile = async (e) => {
    e.preventDefault();
    try { await api.files.create(id, newFile); setNewFile({ name: '', url: '', file_type: 'link' }); setShowFileForm(false); load(); toast('Archivo agregado', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  };

  const addMember = async (userId) => {
    try { const r = await api.projects.addMember(id, userId); toast(`${r.name} agregado`, 'success'); load(); setWorkspaceMembers([]); api.workspace.members().then(setWorkspaceMembers); }
    catch (e) { toast(e.message, 'error'); }
  };

  const askAI = async (e) => {
    e.preventDefault();
    if (!aiInput.trim()) return;
    const q = aiInput; setAiInput('');
    setAiMessages(m => [...m, { role: 'user', content: q }]);
    setAiLoading(true);
    try { const { answer } = await api.ai.ask(id, q); setAiMessages(m => [...m, { role: 'assistant', content: answer }]); }
    catch (e) { setAiMessages(m => [...m, { role: 'assistant', content: `❌ ${e.message}` }]); }
    finally { setAiLoading(false); }
  };

  const saveContext = async () => {
    try { await api.projects.updateAI(id, aiContext); setEditingContext(false); toast('Contexto guardado', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  };

  const deleteProject = async () => {
    if (!confirm(`¿Eliminar "${project?.name}"? No se puede deshacer.`)) return;
    try { await api.projects.delete(id); toast('Proyecto eliminado', 'success'); refreshProjects(); navigate('/'); }
    catch (e) { toast(e.message, 'error'); }
  };

  if (loading) return <div className="flex justify-center items-center" style={{ height: '100%', padding: 80 }}><div className="loader" /></div>;
  if (!project) return null;

  const tasksDone = project.tasks?.filter(t => t.status === 'done') || [];
  const tasksPending = project.tasks?.filter(t => t.status === 'pending') || [];
  const tasksInProgress = project.tasks?.filter(t => t.status === 'in_progress') || [];

  return (
    <div>
      <div className="project-header">
        <div className="proj-icon-lg">{project.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="proj-title">{project.name}</div>
          <div className="proj-meta">
            <span className={`badge badge-${project.status}`}>{statusLabels[project.status]}</span>
            {project.category && <span className="tag">{project.category}</span>}
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>👥 {project.members?.length} miembro(s)</span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>✅ {tasksDone.length}/{project.tasks?.length} tareas</span>
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="progress-wrap" style={{ flex: 1, height: 8 }}>
              <div className="progress-fill" style={{ width: `${project.progress}%`, background: project.color }} />
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, color: project.color }}>{project.progress}%</span>
          </div>
        </div>
        <div className="flex gap-8 flex-wrap">
          {isOwner && <>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowEdit(true)}>✏️ Editar</button>
            <button className="btn btn-danger btn-sm" onClick={deleteProject}>🗑️</button>
          </>}
        </div>
      </div>

      <div style={{ padding: '0 28px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {['overview','tasks','comments','files','team','ai'].map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {{'overview':'📊 Resumen','tasks':'✅ Tareas','comments':'💬 Comentarios','files':'📎 Archivos','team':'👥 Equipo','ai':'🤖 IA'}[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content">
        {tab === 'overview' && (
          <div>
            <div className="card mb-16">
              <div className="font-semibold mb-8" style={{ fontSize: 15 }}>Descripción</div>
              <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.7 }}>{project.description || 'Sin descripción'}</p>
            </div>
            <div className="grid-3 mb-16">
              {[
                { label: 'Pendientes', value: tasksPending.length, icon: '⏳', color: '#f59e0b' },
                { label: 'En Progreso', value: tasksInProgress.length, icon: '🔄', color: '#3b82f6' },
                { label: 'Completadas', value: tasksDone.length, icon: '✅', color: '#10b981' },
              ].map(s => (
                <div key={s.label} className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28 }}>{s.icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{s.label}</div>
                </div>
              ))}
            </div>
            {project.tasks?.length > 0 && (
              <div className="card">
                <div className="font-semibold mb-12" style={{ fontSize: 15 }}>Tareas Recientes</div>
                {project.tasks.slice(0, 5).map(t => (
                  <div key={t.id} className="task-item">
                    <div className={`task-check ${t.status === 'done' ? 'done' : t.status === 'in_progress' ? 'in-progress' : ''}`}>
                      {t.status === 'done' && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className={`task-title ${t.status === 'done' ? 'done' : ''}`}>{t.title}</div>
                      {(t.steps || []).length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <div style={{ flex: 1, height: 3, background: 'var(--bg4)', borderRadius: 99 }}>
                            <div style={{ width: `${t.progress||0}%`, height: '100%', background: '#6366f1', borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t.progress||0}%</span>
                        </div>
                      )}
                    </div>
                    <span className={`badge priority-${t.priority}`}>{t.priority}</span>
                  </div>
                ))}
                <button onClick={() => setTab('tasks')} style={{ width: '100%', marginTop: 12, padding: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text2)', fontSize: 12 }}>
                  Ver todas las tareas →
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'tasks' && (
          <div>
            <form onSubmit={addTask} className="flex gap-8 mb-16">
              <input className="input flex-1" placeholder="Nueva tarea..." value={newTask} onChange={e => setNewTask(e.target.value)} />
              <select className="input" style={{ width: 130 }} value={taskPriority} onChange={e => setTaskPriority(e.target.value)}>
                <option value="low">🟢 Baja</option>
                <option value="medium">🟡 Media</option>
                <option value="high">🔴 Alta</option>
              </select>
              <button className="btn btn-primary" type="submit">+ Agregar</button>
            </form>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
              💡 Haz clic en <strong>▶</strong> para expandir y agregar pasos a una tarea. El progreso se calcula automáticamente.
            </div>
            {project.tasks?.length === 0 ? (
              <div className="empty-state"><div className="icon">✅</div><p>No hay tareas. ¡Agrega la primera!</p></div>
            ) : (
              ['in_progress','pending','done'].map(status => {
                const group = project.tasks.filter(t => t.status === status);
                if (!group.length) return null;
                return (
                  <div key={status} className="mb-20">
                    <div className="flex items-center gap-8 mb-12">
                      <span style={{ fontSize: 13, fontWeight: 600, color: status==='done'?'#10b981':status==='in_progress'?'#f59e0b':'var(--text2)' }}>
                        {status==='pending'?'⏳ Pendiente':status==='in_progress'?'🔄 En Progreso':'✅ Completado'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg4)', padding: '2px 8px', borderRadius: 99 }}>{group.length}</span>
                    </div>
                    {group.map(t => (
                      <TaskItem key={t.id} task={t} projectId={id}
                        onUpdate={() => { load(); refreshProjects(); }}
                        onDelete={deleteTask} isOwner={isOwner} />
                    ))}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'comments' && (
          <div>
            <form onSubmit={addComment} className="flex gap-8 mb-20">
              <input className="input flex-1" placeholder="Escribe un comentario..." value={newComment} onChange={e => setNewComment(e.target.value)} />
              <button className="btn btn-primary" type="submit">Enviar</button>
            </form>
            <div className="card">
              {project.comments?.length === 0
                ? <div className="empty-state"><div className="icon">💬</div><p>Sin comentarios. ¡Inicia la conversación!</p></div>
                : project.comments?.map(c => (
                  <div key={c.id} className="comment">
                    <div className="avatar" style={{ background: c.avatar_color||'#6366f1', color:'#fff' }}>{c.user_name?.charAt(0)}</div>
                    <div className="comment-body">
                      <div className="comment-header"><span className="comment-name">{c.user_name}</span><span className="comment-time">{timeAgo(c.created_at)}</span></div>
                      <div className="comment-text">{c.content}</div>
                    </div>
                    {(c.user_id===user?.id||user?.role==='host') && <button onClick={()=>api.comments.delete(id,c.id).then(load)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:14}}>×</button>}
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {tab === 'files' && (
          <div>
            <div className="flex justify-between items-center mb-16">
              <div style={{ fontSize: 15, fontWeight: 600 }}>Archivos y Recursos</div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowFileForm(!showFileForm)}>+ Agregar</button>
            </div>
            {showFileForm && (
              <form onSubmit={addFile} className="card mb-16">
                <div className="flex gap-8 mb-8">
                  <div className="flex-1"><label className="label">Nombre</label><input className="input" placeholder="Nombre" value={newFile.name} onChange={e=>setNewFile(f=>({...f,name:e.target.value}))} required /></div>
                  <div style={{width:130}}><label className="label">Tipo</label>
                    <select className="input" value={newFile.file_type} onChange={e=>setNewFile(f=>({...f,file_type:e.target.value}))}>
                      <option value="link">🔗 Link</option><option value="doc">📄 Doc</option><option value="image">🖼️ Imagen</option><option value="video">🎥 Video</option><option value="other">📎 Otro</option>
                    </select>
                  </div>
                </div>
                <div className="form-group"><label className="label">URL (opcional)</label><input className="input" placeholder="https://..." value={newFile.url} onChange={e=>setNewFile(f=>({...f,url:e.target.value}))} /></div>
                <div className="flex gap-8"><button type="submit" className="btn btn-primary btn-sm">Guardar</button><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setShowFileForm(false)}>Cancelar</button></div>
              </form>
            )}
            {project.files?.length===0
              ? <div className="empty-state"><div className="icon">📎</div><p>No hay archivos aún.</p></div>
              : project.files?.map(f => (
                <div key={f.id} className="file-item">
                  <span className="file-icon">{{'link':'🔗','doc':'📄','image':'🖼️','video':'🎥','other':'📎'}[f.file_type]||'📎'}</span>
                  <div className="file-info"><div className="file-name">{f.name}</div><div className="file-meta">Por {f.uploader_name} · {timeAgo(f.created_at)}</div></div>
                  {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Abrir →</a>}
                  {(f.uploaded_by===user?.id||user?.role==='host') && <button onClick={()=>api.files.delete(id,f.id).then(load)} className="btn btn-danger btn-sm">×</button>}
                </div>
              ))
            }
          </div>
        )}

        {tab === 'team' && (
          <div>
            <div className="card mb-16">
              <div className="font-semibold mb-12" style={{ fontSize: 15 }}>Miembros del Proyecto</div>
              {project.members?.map(m => (
                <div key={m.id} className="member-item">
                  <div className="avatar avatar-lg" style={{ background: m.avatar_color||'#6366f1', color:'#fff' }}>{m.name?.charAt(0)}</div>
                  <div className="member-info"><div className="member-name">{m.name} {m.id===user?.id&&'(tú)'}</div><div className="member-email">{m.email}</div></div>
                  <span className={`badge ${m.role==='owner'?'badge-active':'badge-backlog'}`}>{m.role==='owner'?'👑 Owner':'👤 Miembro'}</span>
                  {isOwner&&m.id!==user?.id && <button className="btn btn-danger btn-sm" onClick={()=>api.projects.removeMember(id,m.id).then(load)}>Remover</button>}
                </div>
              ))}
            </div>

            {isOwner && notInProject.length > 0 && (
              <div className="card">
                <div className="font-semibold mb-4" style={{ fontSize: 15 }}>Miembros de Hub7 disponibles</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>Ya forman parte del workspace. Agrégalos a este proyecto.</div>
                {notInProject.map(m => (
                  <div key={m.id} className="member-item">
                    <div className="avatar avatar-lg" style={{ background: m.avatar_color||'#6366f1', color:'#fff' }}>{m.name?.charAt(0)}</div>
                    <div className="member-info"><div className="member-name">{m.name}</div><div className="member-email">{m.email}</div></div>
                    <button className="btn btn-primary btn-sm" onClick={() => addMember(m.id)}>+ Agregar al proyecto</button>
                  </div>
                ))}
              </div>
            )}

            {isOwner && notInProject.length === 0 && workspaceMembers.length > 1 && (
              <div className="card" style={{ textAlign:'center', color:'var(--text3)', fontSize:13, padding: 20 }}>
                ✅ Todos los miembros del workspace ya están en este proyecto.
              </div>
            )}
          </div>
        )}

        {tab === 'ai' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
              <div className="card" style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div className="flex items-center gap-8 mb-4">
                  <span style={{ fontSize: 20 }}>🤖</span>
                  <div><div style={{ fontWeight:700 }}>Asistente IA</div><div style={{ fontSize:11, color:'var(--text3)' }}>Pregunta cualquier cosa sobre el proyecto</div></div>
                </div>
                <div className="ai-chat" style={{ minHeight:300, maxHeight:400, overflowY:'auto', padding:'4px 0' }}>
                  {aiMessages.map((m,i) => <div key={i} className={`ai-message ${m.role}`}>{m.content}</div>)}
                  {aiLoading && <div className="ai-message assistant"><div className="ai-typing"><span/><span/><span/></div></div>}
                  <div ref={aiEndRef} />
                </div>
                <form onSubmit={askAI} className="ai-input-row">
                  <input className="input" placeholder="¿Cuál es el siguiente paso?..." value={aiInput} onChange={e=>setAiInput(e.target.value)} disabled={aiLoading} />
                  <button className="btn btn-primary" type="submit" disabled={aiLoading||!aiInput.trim()}>{aiLoading?'...':'→'}</button>
                </form>
              </div>
              <div className="card">
                <div className="flex items-center justify-between mb-12">
                  <div><div style={{ fontWeight:700, fontSize:14 }}>Contexto del Proyecto</div><div style={{ fontSize:11, color:'var(--text3)' }}>La IA usa esto como base</div></div>
                  {!editingContext
                    ? <button className="btn btn-ghost btn-sm" onClick={()=>setEditingContext(true)}>✏️</button>
                    : <div className="flex gap-6"><button className="btn btn-primary btn-sm" onClick={saveContext}>Guardar</button><button className="btn btn-ghost btn-sm" onClick={()=>setEditingContext(false)}>Cancelar</button></div>
                  }
                </div>
                {editingContext
                  ? <textarea className="input" style={{ minHeight:300, fontSize:12 }} value={aiContext} onChange={e=>setAiContext(e.target.value)} />
                  : <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.7, minHeight:200, whiteSpace:'pre-wrap' }}>
                      {aiContext||<span style={{color:'var(--text3)'}}>Sin contexto. Haz clic en ✏️ para agregar.</span>}
                    </div>
                }
              </div>
            </div>
          </div>
        )}
      </div>

      {showEdit && (
        <ProjectModal project={project} onClose={()=>setShowEdit(false)} onSave={async(data)=>{
          try { await api.projects.update(id,data); toast('Proyecto actualizado','success'); load(); refreshProjects(); setShowEdit(false); }
          catch(e) { toast(e.message,'error'); }
        }} />
      )}
    </div>
  );
}
