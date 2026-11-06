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
import { photoUpload } from '../../middleware/upload.js';
import { limitPerIp } from '../../middleware/rate-limit.js';

/** `:id` inválido vira null e o serviço responde 404. */
const idOf = (req) => idParamSchema.parse(req.params.id);
const photoIdOf = (req) => idParamSchema.parse(req.params.photoId);

/**
 * @param {{
 *   service: ReturnType<typeof import('./service.js').createPostService>,
 *   limits: typeof import('../../middleware/rate-limit.js').DEFAULT_LIMITS,
 * }} deps
 */
export function postsRouter({ service, limits }) {
  const router = Router();

  /** Confere a permissão antes de ler os arquivos (quem não pode não gasta memória/CPU). */
  const canManage = async (req, _res, next) => {
    await service.checkManage(idOf(req), req.user);
    next();
  };

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

  // BR-PHOTO-001..006 — 201 se ao menos uma foto foi salva, 200 se todas foram recusadas.
  router.post('/:id/photos', requireAuth, ...limitPerIp(limits.upload), canManage, ...photoUpload(), async (req, res) => {
    const { saved, rejected, post } = await service.addPhotos(idOf(req), req.user, req.files);
    res.status(saved ? 201 : 200).json({ post, rejected });
  });

  // BR-PHOTO-002/007
  router.delete('/:id/photos/:photoId', requireAuth, async (req, res) => {
    res.json({ post: await service.removePhoto(idOf(req), photoIdOf(req), req.user) });
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
