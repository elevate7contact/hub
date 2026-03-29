const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_color: user.avatar_color } });
});

// Register via invitation
router.post('/register', (req, res) => {
  const { name, email, password, invite_code } = req.body;
  if (!name || !email || !password || !invite_code) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }

  const invitation = db.prepare('SELECT * FROM invitations WHERE code = ? AND status = ?').get(invite_code, 'pending');
  if (!invitation) return res.status(400).json({ error: 'Código de invitación inválido o ya usado' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(400).json({ error: 'El email ya está registrado' });

  const userId = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
  const color = colors[Math.floor(Math.random() * colors.length)];

  db.prepare(`INSERT INTO users (id, name, email, password_hash, avatar_color) VALUES (?,?,?,?,?)`).run(userId, name, email.toLowerCase(), hash, color);

  // Join project
  const alreadyMember = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(invitation.project_id, userId);
  if (!alreadyMember) {
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?,?,?)').run(invitation.project_id, userId, 'member');
  }

  // Mark invitation used
  db.prepare('UPDATE invitations SET status = ?, used_by = ? WHERE id = ?').run('used', userId, invitation.id);

  const token = jwt.sign({ id: userId, email, name, role: 'member' }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: userId, name, email, role: 'member', avatar_color: color } });
});

// Get current user
router.get('/me', require('../middleware/auth'), (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, avatar_color, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

module.exports = router;
