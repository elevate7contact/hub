const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const projects = db.prepare(`
    SELECT p.*, u.name as owner_name,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as total_tasks,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as done_tasks,
      (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count,
      (SELECT COUNT(*) FROM comments WHERE project_id = p.id) as comment_count
    FROM projects p
    JOIN project_members pm ON p.id = pm.project_id
    JOIN users u ON p.owner_id = u.id
    WHERE pm.user_id = ?
    ORDER BY p.created_at DESC
  `).all(req.user.id);
  res.json(projects);
});

router.get('/:id', auth, (req, res) => {
  const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!member) return res.status(403).json({ error: 'Sin acceso a este proyecto' });

  const project = db.prepare(`SELECT p.*, u.name as owner_name FROM projects p JOIN users u ON p.owner_id = u.id WHERE p.id = ?`).get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const members = db.prepare(`SELECT u.id, u.name, u.email, u.avatar_color, pm.role FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ?`).all(req.params.id);
  const tasksRaw = db.prepare(`SELECT t.*, u.name as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.project_id = ? ORDER BY t.created_at DESC`).all(req.params.id);
  const tasks = tasksRaw.map(t => ({ ...t, steps: JSON.parse(t.steps || '[]') }));
  const comments = db.prepare(`SELECT c.*, u.name as user_name, u.avatar_color FROM comments c JOIN users u ON c.user_id = u.id WHERE c.project_id = ? ORDER BY c.created_at ASC`).all(req.params.id);
  const files = db.prepare(`SELECT f.*, u.name as uploader_name FROM project_files f JOIN users u ON f.uploaded_by = u.id WHERE f.project_id = ? ORDER BY f.created_at DESC`).all(req.params.id);
  const ai = db.prepare('SELECT context_text FROM ai_context WHERE project_id = ?').get(req.params.id);

  res.json({ ...project, members, tasks, comments, files, ai_context: ai?.context_text || '' });
});

router.post('/', auth, (req, res) => {
  if (req.user.role !== 'host') return res.status(403).json({ error: 'Solo el host puede crear proyectos' });
  const { name, description, color, icon, category, progress, status } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const id = uuidv4();
  db.prepare(`INSERT INTO projects (id, name, description, color, icon, category, progress, status, owner_id) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(id, name, description || '', color || '#6366f1', icon || '🚀', category || '', progress || 0, status || 'active', req.user.id);
  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?,?,?)').run(id, req.user.id, 'owner');
  db.prepare('INSERT INTO ai_context (id, project_id, context_text) VALUES (?,?,?)').run(uuidv4(), id, '');
  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
});

router.put('/:id', auth, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
  if (project.owner_id !== req.user.id && req.user.role !== 'host') return res.status(403).json({ error: 'Sin permiso' });
  const { name, description, color, icon, category, progress, status } = req.body;
  const taskCount = db.prepare('SELECT COUNT(*) as c FROM tasks WHERE project_id = ?').get(req.params.id).c;
  const newProgress = (taskCount === 0 && progress !== undefined) ? progress : project.progress;
  db.prepare(`UPDATE projects SET name=COALESCE(?,name), description=COALESCE(?,description), color=COALESCE(?,color), icon=COALESCE(?,icon), category=COALESCE(?,category), progress=?, status=COALESCE(?,status) WHERE id=?`)
    .run(name, description, color, icon, category, newProgress, status, req.params.id);
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

router.delete('/:id', auth, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
  if (project.owner_id !== req.user.id && req.user.role !== 'host') return res.status(403).json({ error: 'Sin permiso' });
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/:id/members', auth, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project || (project.owner_id !== req.user.id && req.user.role !== 'host')) return res.status(403).json({ error: 'Sin permiso' });
  const { userId } = req.body;
  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  const already = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, userId);
  if (already) return res.status(400).json({ error: `${user.name} ya es miembro` });
  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?,?,?)').run(req.params.id, userId, 'member');
  res.json({ success: true, name: user.name });
});

router.delete('/:id/members/:userId', auth, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project || (project.owner_id !== req.user.id && req.user.role !== 'host')) return res.status(403).json({ error: 'Sin permiso' });
  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
  res.json({ success: true });
});

router.put('/:id/ai-context', auth, (req, res) => {
  const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!member) return res.status(403).json({ error: 'Sin acceso' });
  db.prepare('UPDATE ai_context SET context_text = ?, updated_at = CURRENT_TIMESTAMP WHERE project_id = ?').run(req.body.context_text, req.params.id);
  res.json({ success: true });
});

module.exports = router;
