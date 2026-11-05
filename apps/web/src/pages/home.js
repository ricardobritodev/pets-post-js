import '../styles/main.css';
import { api } from '../lib/api.js';

function setStatus(key, up, text) {
  document.querySelector(`[data-status="${key}"]`)?.setAttribute('data-state', up ? 'up' : 'down');
  const label = document.querySelector(`[data-status-text="${key}"]`);
  if (label) label.textContent = text;
}

async function checkHealth() {
  try {
    await api('/health');
    setStatus('api', true, 'online');
  } catch {
    setStatus('api', false, 'offline — rode "npm run dev:api"');
    setStatus('db', false, 'desconhecido');
    return;
  }

  try {
    await api('/health/db');
    setStatus('db', true, 'conectado');
  } catch {
    setStatus('db', false, 'sem conexão — confira DATABASE_URL no .env');
  }
}

checkHealth();
