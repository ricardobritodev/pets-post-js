/**
 * redirect.js — Redirect pós-login seguro (BR-AUTH-009, anti open-redirect).
 *
 * Aceita só caminhos relativos do mesmo site: "/posts/12?x=1#foto".
 * Recusa: URLs absolutas (https://mal.com), protocolo relativo (//mal.com),
 * barra invertida (/\mal.com — navegadores tratam como //), esquemas (javascript:),
 * caracteres de controle e caminhos de auth (evita voltar para o próprio login).
 */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const AUTH_PAGES = ['/login', '/cadastro'];

/**
 * @param {unknown} next valor do ?next=
 * @param {string} [fallback]
 * @returns {string} caminho seguro
 */
export function safeRedirectPath(next, fallback = '/') {
  if (typeof next !== 'string' || next.length === 0 || next.length > 2048) return fallback;
  if (CONTROL_CHARS.test(next)) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;

  // Confirma com o parser de URL que continua no mesmo host.
  const base = 'http://petspost.invalid';
  let url;
  try {
    url = new URL(next, base);
  } catch {
    return fallback;
  }
  if (url.origin !== base) return fallback;
  if (AUTH_PAGES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) return fallback;
  return url.pathname + url.search + url.hash;
}
