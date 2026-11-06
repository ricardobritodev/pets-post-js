/**
 * routes.js — Rotas de fotos de um anúncio (posts e adoção usam as mesmas).
 *   POST   /:id/photos            BR-PHOTO-001..006 (201 se ao menos uma foi salva; 200 se todas recusadas)
 *   DELETE /:id/photos/:photoId   BR-PHOTO-002/007
 */
import { idParamSchema } from '@petspost/contracts';
import { requireAuth } from '../../middleware/auth.js';
import { photoUpload } from '../../middleware/upload.js';
import { limitPerIp } from '../../middleware/rate-limit.js';

/**
 * @param {import('express').Router} router
 * @param {{
 *   service: { checkManage: Function, addPhotos: Function, removePhoto: Function },
 *   limits: typeof import('../../middleware/rate-limit.js').DEFAULT_LIMITS,
 *   key: string, // nome do objeto na resposta: 'post' ou 'adoption'
 * }} deps
 */
export function mountPhotoRoutes(router, { service, limits, key }) {
  const idOf = (req) => idParamSchema.parse(req.params.id);

  /** Confere a permissão antes de ler os arquivos (quem não pode não gasta memória/CPU). */
  const canManage = async (req, _res, next) => {
    await service.checkManage(idOf(req), req.user);
    next();
  };

  router.post('/:id/photos', requireAuth, ...limitPerIp(limits.upload), canManage, ...photoUpload(), async (req, res) => {
    const { saved, rejected, item } = await service.addPhotos(idOf(req), req.user, req.files);
    res.status(saved ? 201 : 200).json({ [key]: item, rejected });
  });

  router.delete('/:id/photos/:photoId', requireAuth, async (req, res) => {
    const item = await service.removePhoto(idOf(req), idParamSchema.parse(req.params.photoId), req.user);
    res.json({ [key]: item });
  });
}
