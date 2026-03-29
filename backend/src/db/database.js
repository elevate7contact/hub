const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../../hub.db');
const db = new DatabaseSync(DB_PATH);

// Polyfill for better-sqlite3 compatible API
function prepare(sql) {
  const stmt = db.prepare(sql);
  return {
    run: (...args) => stmt.run(...args),
    get: (...args) => stmt.get(...args),
    all: (...args) => stmt.all(...args),
  };
}

function exec(sql) { db.exec(sql); }

function initializeDB() {
  db.exec(`PRAGMA journal_mode = WAL`);
  db.exec(`PRAGMA foreign_keys = ON`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      avatar_color TEXT DEFAULT '#6366f1',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      owner_id TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      color TEXT DEFAULT '#6366f1',
      icon TEXT DEFAULT '🚀',
      category TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS project_members (
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      project_id TEXT NOT NULL,
      invited_by TEXT NOT NULL,
      used_by TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (invited_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      assigned_to TEXT,
      created_by TEXT,
      due_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      task_id TEXT,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS project_files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT,
      file_type TEXT,
      uploaded_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ai_context (
      id TEXT PRIMARY KEY,
      project_id TEXT UNIQUE NOT NULL,
      context_text TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // Seed admin user (Juan)
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('juan@hub.com');
  if (!existingAdmin) {
    const adminId = uuidv4();
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`INSERT INTO users (id, name, email, password_hash, role, avatar_color) VALUES (?, ?, ?, ?, 'host', '#6366f1')`
    ).run(adminId, 'Juan', 'juan@hub.com', hash);

    const projects = [
      {
        id: uuidv4(), name: 'Copy Trading', icon: '📈',
        description: 'Landing pages para clientes y traders. Red de mercadeo de traders. Dos páginas: una para clientes que no son traders y otra para traders que aplican a trabajar con nosotros.',
        color: '#1a73e8', progress: 5, status: 'active', category: 'Trading',
        context: 'Proyecto de Copy Trading con César y Camila.\n\nNecesitamos:\n1) Landing page para CLIENTES (no traders) mostrando beneficios del servicio copy trading\n2) Landing page para TRADERS que quieren unirse a la red y trabajar con nosotros\n3) Sistema de red de mercadeo/referidos para traders\n\nEquipo: Juan (host), César, Camila\nEstado: Inicio - 0% progreso real'
      },
      {
        id: uuidv4(), name: 'Trading Journal', icon: '📓',
        description: 'Journal de trading personal. Registro de trades, análisis, métricas de desempeño y seguimiento de estrategias.',
        color: '#7c3aed', progress: 70, status: 'active', category: 'Trading',
        context: 'App personal de trading journal de Juan. Ya está ~70% completado.\n\nFuncionalidades existentes (según historial de Claude):\n- Registro de trades\n- Métricas de rendimiento\n- Análisis de estrategias\n\nPendiente:\n- Nuevas funcionalidades por definir\n- Mejoras a las existentes\n\nProyecto solo de Juan.'
      },
      {
        id: uuidv4(), name: 'Tokenización con César', icon: '🪙',
        description: 'Videos promocionales, educativos y CTAs sobre tokenización. Estrategia de marketing completa. Clonación de voz/avatar.',
        color: '#ea580c', progress: 20, status: 'active', category: 'Tokenización',
        context: 'Proyecto de contenido y marketing para tokenización con César.\n\nNecesitamos:\n1) Videos EDUCATIVOS sobre qué es la tokenización\n2) Videos PROMOCIONALES con llamados a la acción\n3) Estrategia de marketing digital completa\n4) Clonación de voz/avatar de César y/o Juan para generar contenido en escala\n\nEquipo: Juan, César\nJuan se encarga de: marketing, contenido, estrategia'
      },
      {
        id: uuidv4(), name: 'App Automatización Marketing', icon: '🤖',
        description: 'Aplicación de automatización de marketing. En etapa inicial con ideas definidas. Desarrollado con Maleja.',
        color: '#16a34a', progress: 0, status: 'active', category: 'Automatización',
        context: 'App de automatización de marketing - PROYECTO EN 0%.\n\nEstado: Apenas iniciando, existen varias ideas pero nada construido aún.\n\nÁreas de automatización planeadas (global para todos los proyectos):\n- Automatización de leads\n- Automatización de campañas\n- Respuestas automatizadas\n- Interfaces\n- Base de datos integrada\n\nEquipo: Juan, Maleja'
      },
      {
        id: uuidv4(), name: 'Tokenización Máquinas Lavado', icon: '⚙️',
        description: 'Tokenización de máquinas de lavado de casco con César. Juan maneja toda la parte de marketing y promociones.',
        color: '#0891b2', progress: 30, status: 'active', category: 'Tokenización',
        context: 'Tokenización de máquinas de lavado de casco.\n\nCésar está más avanzado en el lado del producto/tecnología.\nJuan se encarga de:\n- Marketing y promociones\n- Estrategia de ventas\n- Materiales de comunicación\n\nEquipo: Juan, César'
      },
      {
        id: uuidv4(), name: 'Coworking Tokenización', icon: '🏢',
        description: 'Plan futuro de coworking enfocado en tokenización. Aún no iniciado - plan a largo plazo.',
        color: '#64748b', progress: 0, status: 'backlog', category: 'Tokenización',
        context: 'Proyecto FUTURO de coworking de tokenización.\n\nTodavía NO se ha tocado. Es un plan a largo plazo.\nCuando llegue el momento: definir el concepto, modelo de negocio, ubicación, socios.'
      }
    ];

    const insertProject = db.prepare(`INSERT INTO projects (id, name, icon, description, color, progress, status, category, owner_id) VALUES (?,?,?,?,?,?,?,?,?)`);
    const insertMember = db.prepare(`INSERT INTO project_members (project_id, user_id, role) VALUES (?,?,'owner')`);
    const insertAI = db.prepare(`INSERT INTO ai_context (id, project_id, context_text) VALUES (?,?,?)`);

    for (const p of projects) {
      insertProject.run(p.id, p.name, p.icon, p.description, p.color, p.progress, p.status, p.category, adminId);
      insertMember.run(p.id, adminId);
      insertAI.run(uuidv4(), p.id, p.context);
    }

    console.log('✅ Base de datos inicializada con Juan y 6 proyectos');
  }
}

initializeDB();

// Export compatible API
module.exports = {
  prepare: (sql) => {
    const stmt = db.prepare(sql);
    return {
      run: (...args) => stmt.run(...args),
      get: (...args) => stmt.get(...args),
      all: (...args) => stmt.all(...args),
    };
  },
  exec: (sql) => db.exec(sql),
};
