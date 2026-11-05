/**
 * api.js — Cliente HTTP fino sobre fetch.
 * Erros seguem o formato { error: { code, message, details? } } (specs/api/conventions.md).
 *
 * CSRF (BR-AUTH-012): toda requisição que não é GET leva o header X-CSRF-Token.
 * O token é buscado uma vez em /auth/csrf e trocado quando login/logout devolvem um novo.
 * Se o servidor responder CSRF_INVALID (ex.: sessão expirou), busca outro token e tenta 1 vez.
 */

export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let csrfToken = null;
let csrfPromise = null;

/** Guarda um token novo (vindo de login/logout). */
export function setCsrfToken(token) {
  csrfToken = token ?? null;
}

async function getCsrfToken({ refresh = false } = {}) {
  if (refresh) csrfToken = null;
  if (csrfToken) return csrfToken;
  csrfPromise ??= fetch('/api/v1/auth/csrf', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    .then((r) => r.json())
    .then((b) => (csrfToken = b.csrfToken))
    .finally(() => (csrfPromise = null));
  return csrfPromise;
}

async function send(path, { json, headers, method = 'GET', ...options }, token) {
  return fetch(`/api/v1${path}`, {
    credentials: 'same-origin',
    method,
    ...options,
    headers: {
      Accept: 'application/json',
      ...(json !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { 'X-CSRF-Token': token }),
      ...headers,
    },
    ...(json !== undefined && { body: JSON.stringify(json) }),
  });
}

/**
 * @param {string} path  ex.: '/health'  (prefixo /api/v1 é automático)
 * @param {RequestInit & { json?: unknown }} [options]
 */
export async function api(path, options = {}) {
  const method = (options.method ?? 'GET').toUpperCase();
  const needsCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const opts = { ...options, method };

  let res = await send(path, opts, needsCsrf ? await getCsrfToken() : null);
  let body = await readBody(res);

  if (needsCsrf && res.status === 403 && body?.error?.code === 'CSRF_INVALID') {
    res = await send(path, opts, await getCsrfToken({ refresh: true }));
    body = await readBody(res);
  }

  if (body?.csrfToken) setCsrfToken(body.csrfToken);

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'HTTP_ERROR',
      body?.error?.message ?? res.statusText,
      body?.error?.details ?? [],
    );
  }
  return body;
}

async function readBody(res) {
  return res.headers.get('content-type')?.includes('application/json') ? res.json() : null;
}
