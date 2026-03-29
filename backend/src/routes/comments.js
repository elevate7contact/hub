const express = require('express');
const router = express.Router({ mergeParams: true });
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.projectId, req.user.id);
  if (!member) return res.status(403).json({ error: 'Sin acceso' });

  const comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar_color
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.project_id = ? ORDER BY c.created_at ASC
  `).all(req.params.projectId);
  res.json(comments);
});

router.post('/', auth, (req, res) => {
  const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.projectId, req.user.id);
  if (!member) return res.status(403).json({ error: 'Sin acceso' });

  const { content, task_id } = req.body;
  if (!content) return res.status(400).json({ error: 'Contenido requerido' });

  const id = uuidv4();
  db.prepare('INSERT INTO comments (id, project_id, task_id, user_id, content) VALUES (?,?,?,?,?)').run(id, req.params.projectId, task_id || null, req.user.id, content);

  const comment = db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar_color
    FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?
  `).get(id);
  res.status(201).json(comment);
});

router.delete('/:commentId', auth, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.commentId);
  if (!comment) return res.status(404).json({ error: 'Comentario no encontrado' });
  if (comment.user_id !== req.user.id && req.user.role !== 'host') return res.status(403).json({ error: 'Sin permiso' });
  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.commentId);
  res.json({ success: true });
});

module.exports = router;
