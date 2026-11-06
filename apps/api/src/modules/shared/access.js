/**
 * access.js — Checagem de permissão para escrever num anúncio (posts e adoção).
 * PERM-001/002: inexistente → 404; inativo de outra pessoa → 404 (não revela); ativo de outra → 403.
 */
import { canView, canManage } from '@petspost/domain';
import { HttpError } from '../../middleware/errors.js';

/**
 * @param {(id: number) => Promise<{ userId: number, isActive: boolean } | null>} findAccessInfo
 * @param {{ notFoundMessage: string, forbiddenMessage: string }} messages
 */
export function createManageGuard(findAccessInfo, { notFoundMessage, forbiddenMessage }) {
  const notFound = () => new HttpError(404, 'NOT_FOUND', notFoundMessage);
  return {
    notFound,
    /** Devolve as informações do anúncio (usadas também para a geocodificação). */
    async assertManageable(id, viewer) {
      const info = id ? await findAccessInfo(id) : null;
      if (!info || !canView(viewer, info)) throw notFound();
      if (!canManage(viewer, info)) throw new HttpError(403, 'FORBIDDEN', forbiddenMessage);
      return info;
    },
  };
}
