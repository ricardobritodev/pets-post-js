/**
 * Rotas /api/v1/store (pública) e /api/v1/admin/products — specs/api/store.md
 */
import { Router } from 'express';
import { storeQuerySchema, adminProductsQuerySchema, productSchema, updateProductSchema, idParamSchema } from '@petspost/contracts';
import { validate } from '../../middleware/validate.js';
import { requireAdmin } from '../../middleware/auth.js';
import { mountPhotoRoutes } from '../photos/routes.js';

const idOf = (req) => idParamSchema.parse(req.params.id);

/** @param {{ service: ReturnType<typeof import('./service.js').createStoreService> }} deps */
export function storeRouter({ service }) {
  const router = Router();
  router.get('/products', validate(storeQuerySchema, 'query'), async (req, res) => res.json(await service.list(req.validQuery)));
  router.get('/products/:id', async (req, res) => res.json({ product: await service.get(idOf(req)) }));
  router.get('/categories', async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(await service.categories());
  });
  return router;
}

/**
 * @param {{
 *   service: ReturnType<typeof import('./service.js').createAdminProductService>,
 *   limits: typeof import('../../middleware/rate-limit.js').DEFAULT_LIMITS,
 * }} deps
 */
export function adminProductsRouter({ service, limits }) {
  const router = Router();
  router.use(requireAdmin); // PERM-003 / BR-STORE-006
  router.get('/', validate(adminProductsQuerySchema, 'query'), async (req, res) => res.json(await service.list(req.validQuery)));
  router.get('/:id', async (req, res) => res.json({ product: await service.get(idOf(req)) }));
  router.post('/', validate(productSchema), async (req, res) => res.status(201).json({ product: await service.create(req.body) }));
  router.patch('/:id', validate(updateProductSchema), async (req, res) => res.json({ product: await service.update(idOf(req), req.body) }));
  router.delete('/:id', async (req, res) => {
    await service.remove(idOf(req));
    res.status(204).end();
  });
  mountPhotoRoutes(router, { service, limits, key: 'product' }); // BR-STORE-007
  return router;
}
