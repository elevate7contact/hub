const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

function getToken() {
  return localStorage.getItem('hub_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

export const api = {
  auth: {
    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    register: (name, email, password, invite_code) => request('/auth/register', { method: 'POST', body: { name, email, password, invite_code } }),
    me: () => request('/auth/me'),
  },
  projects: {
    list: () => request('/projects'),
    get: (id) => request(`/projects/${id}`),
    create: (data) => request('/projects', { method: 'POST', body: data }),
    update: (id, data) => request(`/projects/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
    invite: (id) => request(`/projects/${id}/invite`, { method: 'POST' }),
    invitations: (id) => request(`/projects/${id}/invitations`),
    removeMember: (id, userId) => request(`/projects/${id}/members/${userId}`, { method: 'DELETE' }),
    updateAI: (id, context_text) => request(`/projects/${id}/ai-context`, { method: 'PUT', body: { context_text } }),
  },
  tasks: {
    list: (pid) => request(`/projects/${pid}/tasks`),
    create: (pid, data) => request(`/projects/${pid}/tasks`, { method: 'POST', body: data }),
    update: (pid, tid, data) => request(`/projects/${pid}/tasks/${tid}`, { method: 'PUT', body: data }),
    delete: (pid, tid) => request(`/projects/${pid}/tasks/${tid}`, { method: 'DELETE' }),
  },
  comments: {
    list: (pid) => request(`/projects/${pid}/comments`),
    create: (pid, content) => request(`/projects/${pid}/comments`, { method: 'POST', body: { content } }),
    delete: (pid, cid) => request(`/projects/${pid}/comments/${cid}`, { method: 'DELETE' }),
  },
  files: {
    list: (pid) => request(`/projects/${pid}/files`),
    create: (pid, data) => request(`/projects/${pid}/files`, { method: 'POST', body: data }),
    delete: (pid, fid) => request(`/projects/${pid}/files/${fid}`, { method: 'DELETE' }),
  },
  ai: {
    ask: (pid, question) => request(`/projects/${pid}/ai/ask`, { method: 'POST', body: { question } }),
  },
};
