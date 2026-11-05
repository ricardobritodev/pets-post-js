/**
 * Spec: specs/api/health.md
 *   GET /api/v1/health     → 200 { status: "ok" }           (processo vivo)
 *   GET /api/v1/health/db  → 200 { status: "ok", db: "up" } | 503 { db: "down" }
 */
import { Router } from 'express';

export function healthRouter({ db }) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
  });

  router.get('/db', async (_req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', db: 'up' });
    } catch {
      res.status(503).json({ status: 'error', db: 'down' });
    }
  });

  return router;
}
