/**
 * Rotas /api/v1/auth — specs/api/auth.md
 */
import { Router } from 'express';
import { registerSchema, loginSchema } from '@petspost/contracts';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { limitPerIp } from '../../middleware/rate-limit.js';
import { regenerateSession, saveSession, SESSION_TTL_MS, REMEMBER_TTL_MS } from '../../middleware/session.js';
import { toPublicUser } from './service.js';

/**
 * @param {{ auth: ReturnType<typeof import('./service.js').createAuthService>,
 *           csrf: { issueToken: Function }, limits: typeof import('../../middleware/rate-limit.js').DEFAULT_LIMITS,
 *           securityLog: Function }} deps
 */
export function authRouter({ auth, csrf, limits, securityLog }) {
  const router = Router();
  const ctx = (req) => ({ ip: req.ip });

  router.get('/csrf', ...limitPerIp(limits.csrf), (req, res) => {
    res.json({ csrfToken: csrf.issueToken(req, res) });
  });

  router.post('/register', ...limitPerIp(limits.register), validate(registerSchema), async (req, res) => {
    const user = await auth.register(req.body, ctx(req));
    res.status(201).json({ user });
  });

  router.post('/login', ...limitPerIp(limits.login), validate(loginSchema), async (req, res) => {
    const user = await auth.login(req.body, ctx(req));
    // BR-AUTH-013 — ID de sessão novo no login (contra fixação de sessão).
    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.cookie.maxAge = req.body.remember ? REMEMBER_TTL_MS : SESSION_TTL_MS; // BR-AUTH-008
    const csrfToken = csrf.issueToken(req, res);
    await saveSession(req);
    res.json({ user, csrfToken });
  });

  router.post('/logout', requireAuth, async (req, res) => {
    securityLog('logout', { userId: req.user.id, ip: req.ip });
    // regenerate = destrói a sessão no banco e começa uma anônima (BR-AUTH-013).
    await regenerateSession(req);
    const csrfToken = csrf.issueToken(req, res);
    await saveSession(req);
    res.json({ csrfToken });
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: toPublicUser(req.user) });
  });

  return router;
}
