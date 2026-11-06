/**
 * Rotas /api/v1/adoption e /api/v1/me/adoption — specs/api/adoption.md
 */
import { Router } from 'express';
import {
  createAdoptionSchema,
  updateAdoptionSchema,
  listAdoptionQuerySchema,
  pageOnlyQuerySchema,
  idParamSchema,
} from '@petspost/contracts';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { mountPhotoRoutes } from '../photos/routes.js';

const idOf = (req) => idParamSchema.parse(req.params.id);

/**
 * @param {{
 *   service: ReturnType<typeof import('./service.js').createAdoptionService>,
 *   limits: typeof import('../../middleware/rate-limit.js').DEFAULT_LIMITS,
 * }} deps
 */
export function adoptionRouter({ service, limits }) {
  const router = Router();

  router.get('/', validate(listAdoptionQuerySchema, 'query'), async (req, res) => {
    res.json(await service.list(req.validQuery));
  });

  router.get('/:id', async (req, res) => {
    res.json({ adoption: await service.get(idOf(req), req.user) });
  });

  router.post('/', requireAuth, validate(createAdoptionSchema), async (req, res) => {
    res.status(201).json({ adoption: await service.create(req.user, req.body) });
  });

  router.patch('/:id', requireAuth, validate(updateAdoptionSchema), async (req, res) => {
    res.json({ adoption: await service.update(idOf(req), req.user, req.body) });
  });

  router.delete('/:id', requireAuth, async (req, res) => {
    await service.remove(idOf(req), req.user);
    res.status(204).end();
  });

  router.post('/:id/adopted', requireAuth, async (req, res) => {
    res.json({ adoption: await service.markAdopted(idOf(req), req.user) });
  });

  mountPhotoRoutes(router, { service, limits, key: 'adoption' });

  return router;
}

/** GET /api/v1/me/adoption */
export function meAdoptionRouter({ service }) {
  const router = Router();
  router.get('/adoption', requireAuth, validate(pageOnlyQuerySchema, 'query'), async (req, res) => {
    res.json(await service.listMine(req.user.id, req.validQuery.page));
  });
  return router;
}
