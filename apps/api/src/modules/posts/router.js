/**
 * Rotas /api/v1/posts e /api/v1/me/posts — specs/api/posts.md
 */
import { Router } from 'express';
import {
  createPostSchema,
  updatePostSchema,
  listPostsQuerySchema,
  pageOnlyQuerySchema,
  idParamSchema,
} from '@petspost/contracts';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';

/** `:id` inválido vira null e o serviço responde 404. */
const idOf = (req) => idParamSchema.parse(req.params.id);

/** @param {{ service: ReturnType<typeof import('./service.js').createPostService> }} deps */
export function postsRouter({ service }) {
  const router = Router();

  router.get('/', validate(listPostsQuerySchema, 'query'), async (req, res) => {
    res.json(await service.list(req.validQuery));
  });

  // Antes de /:id para "recent" não ser lido como id.
  router.get('/recent', async (_req, res) => {
    res.json(await service.recent());
  });

  router.get('/:id', async (req, res) => {
    res.json({ post: await service.get(idOf(req), req.user) });
  });

  router.post('/', requireAuth, validate(createPostSchema), async (req, res) => {
    res.status(201).json({ post: await service.create(req.user, req.body) });
  });

  router.patch('/:id', requireAuth, validate(updatePostSchema), async (req, res) => {
    res.json({ post: await service.update(idOf(req), req.user, req.body) });
  });

  router.delete('/:id', requireAuth, async (req, res) => {
    await service.remove(idOf(req), req.user);
    res.status(204).end();
  });

  router.post('/:id/resolve', requireAuth, async (req, res) => {
    res.json({ post: await service.resolve(idOf(req), req.user) });
  });

  return router;
}

/** /api/v1/me/* — dados do usuário logado. */
export function meRouter({ service }) {
  const router = Router();
  router.get('/posts', requireAuth, validate(pageOnlyQuerySchema, 'query'), async (req, res) => {
    res.json(await service.listMine(req.user.id, req.validQuery.page));
  });
  return router;
}
