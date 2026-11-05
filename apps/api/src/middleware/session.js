/**
 * session.js — Sessão por cookie + proteção CSRF (double submit).
 * Spec: specs/api/auth.md · BR-AUTH-008, BR-AUTH-012
 */
import { createHmac } from 'node:crypto';
import session from 'express-session';
import { doubleCsrf } from 'csrf-csrf';

export const SESSION_COOKIE = 'petspost.sid';
export const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 h sem uso
export const REMEMBER_TTL_MS = 7 * 24 * 60 * 60 * 1000; // "lembrar de mim"
export const CSRF_HEADER = 'x-csrf-token';

/** Deriva segredos diferentes do SESSION_SECRET para cada uso. */
const derive = (secret, purpose) => createHmac('sha256', secret).update(purpose).digest('hex');

/** BR-AUTH-008 — cookie HttpOnly, SameSite=Lax, Secure em produção, renovado a cada requisição. */
export function sessionMiddleware({ config, store }) {
  const production = config.NODE_ENV === 'production';
  return session({
    name: SESSION_COOKIE,
    secret: config.SESSION_SECRET,
    store,
    resave: false,
    saveUninitialized: false, // não grava sessão de quem só está navegando
    rolling: true,
    proxy: production,
    cookie: { httpOnly: true, sameSite: 'lax', secure: production, maxAge: SESSION_TTL_MS, path: '/' },
  });
}

/**
 * BR-AUTH-012 — CSRF double submit amarrado à sessão.
 * O token vai num cookie HttpOnly (assinado com HMAC) e precisa voltar no header X-CSRF-Token.
 */
export function csrf({ config }) {
  const production = config.NODE_ENV === 'production';
  const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => derive(config.SESSION_SECRET, 'csrf'),
    getSessionIdentifier: (req) => req.session.id,
    // __Host- exige Secure: só em produção (em dev o cookie é http).
    cookieName: production ? '__Host-petspost.csrf' : 'petspost.csrf',
    cookieOptions: { sameSite: 'lax', secure: production, httpOnly: true, path: '/' },
    getCsrfTokenFromRequest: (req) => req.headers[CSRF_HEADER],
    errorConfig: { statusCode: 403, message: 'Token CSRF ausente ou inválido. Recarregue a página.', code: 'CSRF_INVALID' },
  });

  /**
   * Emite um token para a sessão atual. A sessão anônima é marcada para ser gravada,
   * senão o ID mudaria a cada requisição e o token nunca validaria.
   */
  const issueToken = (req, res) => {
    req.session.csrf = true;
    return generateCsrfToken(req, res, { overwrite: true });
  };

  return { protect: doubleCsrfProtection, issueToken };
}

/** Promisifica os métodos de sessão baseados em callback. */
export const regenerateSession = (req) => new Promise((ok, fail) => req.session.regenerate((e) => (e ? fail(e) : ok())));
export const saveSession = (req) => new Promise((ok, fail) => req.session.save((e) => (e ? fail(e) : ok())));
