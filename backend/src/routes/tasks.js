const express = require('express');
const router = express.Router({ mergeParams: true });
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const auth = require('../middleware/auth');

function checkAccess(projectId, userId) {
  return db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);
}

function recalcProgress(projectId) {
  const total = db.prepare('SELECT COUNT(*) as c FROM tasks WHERE project_id = ?').get(projectId).c;
  const done = db.prepare("SELECT COUNT(*) as c FROM tasks WHERE project_id = ? AND status = 'done'").get(projectId).c;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  db.prepare('UPDATE projects SET progress = ? WHERE id = ?').run(progress, projectId);
  return progress;
}

router.get('/', auth, (req, res) => {
  if (!checkAccess(req.params.projectId, req.user.id)) return res.status(403).json({ error: 'Sin acceso' });
  const tasks = db.prepare(`
    SELECT t.*, u.name as assignee_name, u2.name as creator_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users u2 ON t.created_by = u2.id
    WHERE t.project_id = ? ORDER BY t.created_at DESC
  `).all(req.params.projectId);
  res.json(tasks);
});

router.post('/', auth, (req, res) => {
  if (!checkAccess(req.params.projectId, req.user.id)) return res.status(403).json({ error: 'Sin acceso' });
  const { title, description, priority, assigned_to, due_date } = req.body;
  if (!title) return res.status(400).json({ error: 'Título requerido' });

  const id = uuidv4();
  db.prepare(`INSERT INTO tasks (id, project_id, title, description, priority, assigned_to, due_date, created_by) VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, req.params.projectId, title, description || '', priority || 'medium', assigned_to || null, due_date || null, req.user.id);

  recalcProgress(req.params.projectId);
  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
});

router.put('/:taskId', auth, (req, res) => {
  if (!checkAccess(req.params.projectId, req.user.id)) return res.status(403).json({ error: 'Sin acceso' });
  const { title, description, status, priority, assigned_to, due_date } = req.body;
  db.prepare(`UPDATE tasks SET title=COALESCE(?,title), description=COALESCE(?,description),
    status=COALESCE(?,status), priority=COALESCE(?,priority), assigned_to=COALESCE(?,assigned_to), due_date=COALESCE(?,due_date)
    WHERE id = ? AND project_id = ?`)
    .run(title, description, status, priority, assigned_to, due_date, req.params.taskId, req.params.projectId);

  recalcProgress(req.params.projectId);
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId));
});

router.delete('/:taskId', auth, (req, res) => {
  if (!checkAccess(req.params.projectId, req.user.id)) return res.status(403).json({ error: 'Sin acceso' });
  db.prepare('DELETE FROM tasks WHERE id = ? AND project_id = ?').run(req.params.taskId, req.params.projectId);
  recalcProgress(req.params.projectId);
  res.json({ success: true });
});

module.exports = router;
