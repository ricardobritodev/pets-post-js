/**
 * session.js — Estado de login no front (T3.14).
 * getMe() é cacheado por página: o header e a página usam a mesma consulta.
 */
import { api, ApiError } from './api.js';

let mePromise = null;

/** Usuário logado ou null. */
export function getMe({ refresh = false } = {}) {
  if (refresh) mePromise = null;
  mePromise ??= api('/auth/me')
    .then((b) => b.user)
    .catch((err) => {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    });
  return mePromise;
}

export async function login({ email, password, remember }) {
  const { user } = await api('/auth/login', { method: 'POST', json: { email, password, remember } });
  mePromise = Promise.resolve(user);
  return user;
}

export async function register(data) {
  const { user } = await api('/auth/register', { method: 'POST', json: data });
  return user;
}

export async function logout() {
  await api('/auth/logout', { method: 'POST' });
  mePromise = Promise.resolve(null);
}

/** Manda para o login guardando onde o usuário estava (BR-AUTH-009). */
export function redirectToLogin() {
  const next = location.pathname + location.search;
  location.assign(`/login/?next=${encodeURIComponent(next)}`);
}
