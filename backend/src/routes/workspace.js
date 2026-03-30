const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// Get all workspace members
router.get('/members', auth, (req, res) => {
  const members = db.prepare('SELECT id, name, email, role, avatar_color, created_at FROM users ORDER BY created_at ASC').all();
  res.json(members);
});

// Get workspace invite code (host only)
router.get('/invite-code', auth, (req, res) => {
  if (req.user.role !== 'host') return res.status(403).json({ error: 'Solo el host' });
  const config = db.prepare("SELECT value FROM workspace_config WHERE key = 'invite_code'").get();
  res.json({ code: config?.value || 'HUB7-ACCESO' });
});

// Regenerate workspace invite code (host only)
router.post('/invite-code/regenerate', auth, (req, res) => {
  if (req.user.role !== 'host') return res.status(403).json({ error: 'Solo el host' });
  const newCode = 'HUB7-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  db.prepare("UPDATE workspace_config SET value = ?, updated_at = datetime('now') WHERE key = 'invite_code'").run(newCode);
  res.json({ code: newCode });
});

module.exports = router;
