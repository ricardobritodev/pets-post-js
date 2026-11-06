/**
 * Serviço de posts — permissões PERM-001/002 e regras BR-POST-*.
 */
import { canView, canManage } from '@petspost/domain';
import { HttpError } from '../../middleware/errors.js';
import { toPostCard, toPostDetail } from './presenter.js';

const notFound = () => new HttpError(404, 'NOT_FOUND', 'Anúncio não encontrado.');

/**
 * @param {{
 *   posts: ReturnType<typeof import('./repository.js').createPostRepository>,
 *   photos: ReturnType<typeof import('../photos/service.js').createPhotoService>,
 * }} deps
 */
export function createPostService({ posts, photos }) {
  /**
   * Garante que o usuário pode gerenciar o post.
   * Inexistente → 404. Inativo de outra pessoa → 404 (PERM-002, não revela). Ativo de outra → 403 (PERM-001).
   */
  async function assertManageable(id, viewer) {
    const info = id ? await posts.findAccessInfo(id) : null;
    if (!info || !canView(viewer, info)) throw notFound();
    if (!canManage(viewer, info)) throw new HttpError(403, 'FORBIDDEN', 'Você não pode alterar este anúncio.');
    return info;
  }

  /** Detalhe atualizado depois de mexer nas fotos. */
  const freshDetail = async (id, viewer) => toPostDetail(await posts.findDetail(id), viewer);

  return {
    /** Usado pela rota de upload antes de ler os arquivos (não processa upload de quem não pode). */
    checkManage: (id, viewer) => assertManageable(id, viewer),

    async list(query) {
      const page = await posts.listPublic(query);
      return { ...page, items: page.items.map(toPostCard) };
    },

    async recent() {
      return { items: (await posts.recent()).map(toPostCard) };
    },

    async listMine(userId, page) {
      const result = await posts.listByUser(userId, page);
      return { ...result, items: result.items.map(toPostCard) };
    },

    /** PERM-002 — inativo só para dono/admin; resolvido continua público (BR-POST-005). */
    async get(id, viewer) {
      const post = id ? await posts.findDetail(id) : null;
      if (!post || !canView(viewer, post)) throw notFound();
      return toPostDetail(post, viewer);
    },

    /** BR-POST-001 */
    async create(viewer, data) {
      return toPostDetail(await posts.create(viewer.id, data), viewer);
    },

    async update(id, viewer, data) {
      await assertManageable(id, viewer);
      return toPostDetail(await posts.update(id, data), viewer);
    },

    /** BR-POST-006 + BR-PHOTO-007 — os registros saem por CASCADE; os arquivos, depois. */
    async remove(id, viewer) {
      await assertManageable(id, viewer);
      const files = await photos.filenamesOf(id);
      await posts.delete(id);
      await photos.removeFiles(files);
    },

    /** BR-PHOTO-001..006 */
    async addPhotos(id, viewer, files) {
      await assertManageable(id, viewer);
      const { saved, rejected } = await photos.add(id, files);
      return { saved, rejected, post: await freshDetail(id, viewer) };
    },

    /** BR-PHOTO-002/007 */
    async removePhoto(id, photoId, viewer) {
      await assertManageable(id, viewer);
      await photos.remove(id, photoId);
      return freshDetail(id, viewer);
    },

    /** BR-POST-005 — idempotente. */
    async resolve(id, viewer) {
      await assertManageable(id, viewer);
      return toPostDetail(await posts.update(id, { isResolved: true }), viewer);
    },
  };
}
