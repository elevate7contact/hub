const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/database');
const auth = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk');

router.post('/ask', auth, async (req, res) => {
  const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.projectId, req.user.id);
  if (!member) return res.status(403).json({ error: 'Sin acceso' });

  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'Pregunta requerida' });

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
  const aiCtx = db.prepare('SELECT context_text FROM ai_context WHERE project_id = ?').get(req.params.projectId);
  const tasks = db.prepare("SELECT title, status, priority FROM tasks WHERE project_id = ? ORDER BY created_at DESC LIMIT 20").all(req.params.projectId);
  const comments = db.prepare(`
    SELECT c.content, u.name FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.project_id = ? ORDER BY c.created_at DESC LIMIT 10
  `).all(req.params.projectId);

  const systemPrompt = `Eres un asistente de proyecto experto. Ayudas al equipo del proyecto "${project.name}" a resolver dudas, dar sugerencias y desbloquear el trabajo.

CONTEXTO DEL PROYECTO:
- Nombre: ${project.name}
- Descripción: ${project.description}
- Progreso: ${project.progress}%
- Estado: ${project.status}
- Categoría: ${project.category}

INFORMACIÓN ADICIONAL DEL PROYECTO:
${aiCtx?.context_text || 'Sin contexto adicional'}

TAREAS ACTUALES (${tasks.length}):
${tasks.map(t => `- [${t.status}] ${t.title} (${t.priority})`).join('\n') || 'Sin tareas aún'}

COMENTARIOS RECIENTES:
${comments.map(c => `- ${c.name}: "${c.content}"`).join('\n') || 'Sin comentarios'}

Responde en español, de forma clara y concisa. Si puedes dar pasos de acción concretos, hazlo.`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    return res.json({
      answer: `⚠️ Para usar el asistente IA, configura tu ANTHROPIC_API_KEY en /Users/juanmillan/hub/backend/.env\n\nMientras tanto, aquí está el contexto del proyecto:\n\n**${project.name}** (${project.progress}%)\n${project.description}\n\nTareas pendientes: ${tasks.filter(t => t.status === 'pending').length}\nTareas en progreso: ${tasks.filter(t => t.status === 'in_progress').length}\nTareas completadas: ${tasks.filter(t => t.status === 'done').length}`
    });
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }]
    });
    res.json({ answer: message.content[0].text });
  } catch (err) {
    console.error('AI error:', err);
    res.status(500).json({ error: 'Error al consultar la IA: ' + err.message });
  }
});

module.exports = router;
