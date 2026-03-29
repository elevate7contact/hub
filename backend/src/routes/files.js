const express = require('express');
const router = express.Router({ mergeParams: true });
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.projectId, req.user.id);
  if (!member) return res.status(403).json({ error: 'Sin acceso' });
  const files = db.prepare(`SELECT f.*, u.name as uploader_name FROM project_files f JOIN users u ON f.uploaded_by = u.id WHERE f.project_id = ? ORDER BY f.created_at DESC`).all(req.params.projectId);
  res.json(files);
});

router.post('/', auth, (req, res) => {
  const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.projectId, req.user.id);
  if (!member) return res.status(403).json({ error: 'Sin acceso' });
  const { name, url, file_type } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const id = uuidv4();
  db.prepare('INSERT INTO project_files (id, project_id, name, url, file_type, uploaded_by) VALUES (?,?,?,?,?,?)').run(id, req.params.projectId, name, url || '', file_type || 'link', req.user.id);
  const file = db.prepare('SELECT f.*, u.name as uploader_name FROM project_files f JOIN users u ON f.uploaded_by = u.id WHERE f.id = ?').get(id);
  res.status(201).json(file);
});

router.delete('/:fileId', auth, (req, res) => {
  const file = db.prepare('SELECT * FROM project_files WHERE id = ?').get(req.params.fileId);
  if (!file) return res.status(404).json({ error: 'Archivo no encontrado' });
  if (file.uploaded_by !== req.user.id && req.user.role !== 'host') return res.status(403).json({ error: 'Sin permiso' });
  db.prepare('DELETE FROM project_files WHERE id = ?').run(req.params.fileId);
  res.json({ success: true });
});

module.exports = router;
