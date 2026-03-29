require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o)) || origin.endsWith('.vercel.app')) {
      cb(null, true);
    } else {
      cb(new Error('CORS no permitido: ' + origin));
    }
  },
  credentials: true
}));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/projects/:projectId/tasks', require('./routes/tasks'));
app.use('/api/projects/:projectId/comments', require('./routes/comments'));
app.use('/api/projects/:projectId/files', require('./routes/files'));
app.use('/api/projects/:projectId/ai', require('./routes/ai'));

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Hub Backend corriendo en http://localhost:${PORT}`));
