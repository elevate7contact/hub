const express = require('express');
const router = express.Router({ mergeParams: true });
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const auth = require('../middleware/auth');

function checkAccess(projectId, userId) {
  return db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);
}

// Recalculate project progress from average of task progress values
function recalcProgress(projectId) {
  const tasks = db.prepare('SELECT progress FROM tasks WHERE project_id = ?').all(projectId);
  if (tasks.length === 0) return; // no tasks → keep manual project progress
  const avg = Math.round(tasks.reduce((s, t) => s + (t.progress || 0), 0) / tasks.length);
  db.prepare('UPDATE projects SET progress = ? WHERE id = ?').run(avg, projectId);
  return avg;
}

// Calculate task progress from its steps
function calcTaskProgress(steps, currentStatus) {
  if (!steps || steps.length === 0) {
    return currentStatus === 'done' ? 100 : 0;
  }
  const done = steps.filter(s => s.done).length;
  return Math.round((done / steps.length) * 100);
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
  // Parse steps JSON
  res.json(tasks.map(t => ({ ...t, steps: JSON.parse(t.steps || '[]') })));
});

router.post('/', auth, (req, res) => {
  if (!checkAccess(req.params.projectId, req.user.id)) return res.status(403).json({ error: 'Sin acceso' });
  const { title, description, priority, assigned_to, due_date } = req.body;
  if (!title) return res.status(400).json({ error: 'Título requerido' });

  const id = uuidv4();
  db.prepare(`INSERT INTO tasks (id, project_id, title, description, priority, assigned_to, due_date, created_by, steps, progress)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, req.params.projectId, title, description || '', priority || 'medium',
      assigned_to || null, due_date || null, req.user.id, '[]', 0);

  recalcProgress(req.params.projectId);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(201).json({ ...task, steps: [] });
});

router.put('/:taskId', auth, (req, res) => {
  if (!checkAccess(req.params.projectId, req.user.id)) return res.status(403).json({ error: 'Sin acceso' });
  const { title, description, status, priority, assigned_to, due_date, steps } = req.body;

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?').get(req.params.taskId, req.params.projectId);
  if (!existing) return res.status(404).json({ error: 'Tarea no encontrada' });

  let newSteps = steps !== undefined ? steps : JSON.parse(existing.steps || '[]');
  const newStatus = status !== undefined ? status : existing.status;
  const taskProgress = calcTaskProgress(newSteps, newStatus);

  // Auto-set status from steps completion
  let autoStatus = newStatus;
  if (newSteps.length > 0) {
    const doneSteps = newSteps.filter(s => s.done).length;
    autoStatus = doneSteps === newSteps.length ? 'done' : doneSteps > 0 ? 'in_progress' : 'pending';
  }

  db.prepare(`UPDATE tasks SET
    title=COALESCE(?,title),
    description=COALESCE(?,description),
    status=?,
    priority=COALESCE(?,priority),
    assigned_to=COALESCE(?,assigned_to),
    due_date=COALESCE(?,due_date),
    steps=?,
    progress=?
    WHERE id = ? AND project_id = ?`)
    .run(title, description, autoStatus, priority, assigned_to, due_date,
      JSON.stringify(newSteps), taskProgress, req.params.taskId, req.params.projectId);

  recalcProgress(req.params.projectId);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId);
  res.json({ ...task, steps: JSON.parse(task.steps || '[]') });
});

router.delete('/:taskId', auth, (req, res) => {
  if (!checkAccess(req.params.projectId, req.user.id)) return res.status(403).json({ error: 'Sin acceso' });
  db.prepare('DELETE FROM tasks WHERE id = ? AND project_id = ?').run(req.params.taskId, req.params.projectId);
  recalcProgress(req.params.projectId);
  res.json({ success: true });
});

module.exports = router;
