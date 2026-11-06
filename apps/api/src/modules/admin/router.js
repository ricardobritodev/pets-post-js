/**
 * Rotas /api/v1/admin/* — specs/api/admin.md. Tudo atrás de requireAdmin (PERM-003).
 */
import { Router } from 'express';
import {
  adminUsersQuerySchema,
  adminListingsQuerySchema,
  adminPartnersQuerySchema,
  visibilitySchema,
  partnerSchema,
  updatePartnerSchema,
  idParamSchema,
} from '@petspost/contracts';
import { validate } from '../../middleware/validate.js';
import { requireAdmin } from '../../middleware/auth.js';

const idOf = (req) => idParamSchema.parse(req.params.id);

/** @param {{ service: ReturnType<typeof import('./service.js').createAdminService> }} deps */
export function adminRouter({ service }) {
  const router = Router();
  router.use(requireAdmin); // 401 visitante · 403 usuário comum

  router.get('/stats', async (_req, res) => res.json(await service.stats()));

  router.get('/users', validate(adminUsersQuerySchema, 'query'), async (req, res) => {
    res.json(await service.listUsers(req.validQuery));
  });
  router.post('/users/:id/toggle', async (req, res) => {
    res.json({ user: await service.toggleUser(idOf(req), req.user) });
  });

  router.get('/posts', validate(adminListingsQuerySchema, 'query'), async (req, res) => {
    res.json(await service.listPosts(req.validQuery));
  });
  router.patch('/posts/:id', validate(visibilitySchema), async (req, res) => {
    res.json({ item: await service.setPostVisibility(idOf(req), req.body.isActive, req.user) });
  });

  router.get('/adoption', validate(adminListingsQuerySchema, 'query'), async (req, res) => {
    res.json(await service.listAdoptions(req.validQuery));
  });
  router.patch('/adoption/:id', validate(visibilitySchema), async (req, res) => {
    res.json({ item: await service.setAdoptionVisibility(idOf(req), req.body.isActive, req.user) });
  });

  router.get('/partners', validate(adminPartnersQuerySchema, 'query'), async (req, res) => {
    res.json(await service.listPartners(req.validQuery));
  });
  router.get('/partners/:id', async (req, res) => res.json({ partner: await service.getPartner(idOf(req)) }));
  router.post('/partners', validate(partnerSchema), async (req, res) => {
    res.status(201).json(await service.createPartner(req.body));
  });
  router.patch('/partners/:id', validate(updatePartnerSchema), async (req, res) => {
    res.json(await service.updatePartner(idOf(req), req.body));
  });
  router.delete('/partners/:id', async (req, res) => {
    await service.deletePartner(idOf(req));
    res.status(204).end();
  });

  return router;
}
