const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const auth = require('../middleware/auth');

// Get all projects for current user
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

// Get single project
router.get('/:id', auth, (req, res) => {
  const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!member) return res.status(403).json({ error: 'Sin acceso a este proyecto' });

  const project = db.prepare(`
    SELECT p.*, u.name as owner_name
    FROM projects p
    JOIN users u ON p.owner_id = u.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.avatar_color, pm.role
    FROM project_members pm JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
  `).all(req.params.id);

  const tasks = db.prepare(`
    SELECT t.*, u.name as assignee_name
    FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id
    WHERE t.project_id = ? ORDER BY t.created_at DESC
  `).all(req.params.id);

  const files = db.prepare(`
    SELECT f.*, u.name as uploader_name
    FROM project_files f JOIN users u ON f.uploaded_by = u.id
    WHERE f.project_id = ? ORDER BY f.created_at DESC
  `).all(req.params.id);

  const ai = db.prepare('SELECT context_text FROM ai_context WHERE project_id = ?').get(req.params.id);

  res.json({ ...project, members, tasks, files, ai_context: ai?.context_text || '' });
});

// Create project (host only)
router.post('/', auth, (req, res) => {
  if (req.user.role !== 'host') return res.status(403).json({ error: 'Solo el host puede crear proyectos' });
  const { name, description, color, icon, category } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });

  const id = uuidv4();
  db.prepare(`INSERT INTO projects (id, name, description, color, icon, category, owner_id) VALUES (?,?,?,?,?,?,?)`)
    .run(id, name, description || '', color || '#6366f1', icon || '🚀', category || '', req.user.id);
  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?,?,?)').run(id, req.user.id, 'owner');
  db.prepare('INSERT INTO ai_context (id, project_id, context_text) VALUES (?,?,?)').run(uuidv4(), id, '');

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.status(201).json(project);
});

// Update project
router.put('/:id', auth, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
  if (project.owner_id !== req.user.id && req.user.role !== 'host') return res.status(403).json({ error: 'Sin permiso' });

  const { name, description, color, icon, category, progress, status } = req.body;
  db.prepare(`UPDATE projects SET name=COALESCE(?,name), description=COALESCE(?,description),
    color=COALESCE(?,color), icon=COALESCE(?,icon), category=COALESCE(?,category),
    progress=COALESCE(?,progress), status=COALESCE(?,status) WHERE id=?`)
    .run(name, description, color, icon, category, progress, status, req.params.id);

  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

// Delete project (host only)
router.delete('/:id', auth, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
  if (project.owner_id !== req.user.id && req.user.role !== 'host') return res.status(403).json({ error: 'Sin permiso' });

  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Invite user to project
router.post('/:id/invite', auth, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
  if (project.owner_id !== req.user.id && req.user.role !== 'host') return res.status(403).json({ error: 'Sin permiso' });

  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  const id = uuidv4();
  db.prepare('INSERT INTO invitations (id, code, project_id, invited_by) VALUES (?,?,?,?)').run(id, code, req.params.id, req.user.id);
  res.json({ code, project_name: project.name });
});

// Get project invitations
router.get('/:id/invitations', auth, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project || (project.owner_id !== req.user.id && req.user.role !== 'host')) return res.status(403).json({ error: 'Sin permiso' });

  const invitations = db.prepare(`
    SELECT i.*, u.name as inviter_name, u2.name as used_by_name
    FROM invitations i
    JOIN users u ON i.invited_by = u.id
    LEFT JOIN users u2 ON i.used_by = u2.id
    WHERE i.project_id = ? ORDER BY i.created_at DESC
  `).all(req.params.id);
  res.json(invitations);
});

// Remove member from project
router.delete('/:id/members/:userId', auth, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project || (project.owner_id !== req.user.id && req.user.role !== 'host')) return res.status(403).json({ error: 'Sin permiso' });
  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
  res.json({ success: true });
});

// Update AI context
router.put('/:id/ai-context', auth, (req, res) => {
  const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!member) return res.status(403).json({ error: 'Sin acceso' });

  const { context_text } = req.body;
  db.prepare('UPDATE ai_context SET context_text = ?, updated_at = CURRENT_TIMESTAMP WHERE project_id = ?').run(context_text, req.params.id);
  res.json({ success: true });
});

module.exports = router;
