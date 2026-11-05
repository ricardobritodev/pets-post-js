/**
 * api.js — Cliente HTTP fino sobre fetch.
 * Erros seguem o formato { error: { code, message } } (specs/api/conventions.md).
 */

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * @param {string} path  ex.: '/health'  (prefixo /api/v1 é automático)
 * @param {RequestInit & { json?: unknown }} [options]
 */
export async function api(path, { json, headers, ...options } = {}) {
  const res = await fetch(`/api/v1${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(json !== undefined && { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(json !== undefined && { body: JSON.stringify(json) }),
  });

  const body = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.code ?? 'HTTP_ERROR', body?.error?.message ?? res.statusText);
  }
  return body;
}
