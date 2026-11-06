/**
 * Rota /api/v1/partners — specs/api/partners.md
 */
import { Router } from 'express';
import { partnersQuerySchema } from '@petspost/contracts';
import { validate } from '../../middleware/validate.js';

/** @param {{ service: ReturnType<typeof import('./service.js').createPartnerService> }} deps */
export function partnersRouter({ service }) {
  const router = Router();
  router.get('/', validate(partnersQuerySchema, 'query'), async (req, res) => {
    res.set('Cache-Control', 'public, max-age=300'); // parceiros mudam pouco
    res.json(await service.list(req.validQuery));
  });
  return router;
}
