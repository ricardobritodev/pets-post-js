/**
 * Serviço de posts — permissões PERM-001/002 e regras BR-POST-*.
 */
import { canView, canManage } from '@petspost/domain';
import { HttpError } from '../../middleware/errors.js';
import { toPostCard, toPostDetail } from './presenter.js';

const notFound = () => new HttpError(404, 'NOT_FOUND', 'Anúncio não encontrado.');

/** @param {{ posts: ReturnType<typeof import('./repository.js').createPostRepository> }} deps */
export function createPostService({ posts }) {
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

  return {
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

    /** BR-POST-006 */
    async remove(id, viewer) {
      await assertManageable(id, viewer);
      await posts.delete(id);
    },

    /** BR-POST-005 — idempotente. */
    async resolve(id, viewer) {
      await assertManageable(id, viewer);
      return toPostDetail(await posts.update(id, { isResolved: true }), viewer);
    },
  };
}
