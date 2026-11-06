/**
 * Serviço de posts — permissões PERM-001/002 e regras BR-POST-*, BR-PHOTO-*, BR-GEO-*.
 */
import { canView } from '@petspost/domain';
import { createManageGuard } from '../shared/access.js';
import { toPostCard, toPostDetail } from './presenter.js';

/**
 * @param {{
 *   posts: ReturnType<typeof import('./repository.js').createPostRepository>,
 *   photos: ReturnType<typeof import('../photos/service.js').createPhotoService>,
 *   geo: ReturnType<typeof import('../geo/jobs.js').createGeoJobs>,
 * }} deps
 */
export function createPostService({ posts, photos, geo }) {
  const { assertManageable, notFound } = createManageGuard(posts.findAccessInfo, {
    notFoundMessage: 'Anúncio não encontrado.',
    forbiddenMessage: 'Você não pode alterar este anúncio.',
  });

  /** Detalhe atualizado depois de mexer nas fotos. */
  const freshDetail = async (id, viewer) => toPostDetail(await posts.findDetail(id), viewer);

  /** BR-GEO-001 — geocodifica em segundo plano e grava se o endereço não mudou. */
  const scheduleGeocoding = (id, address) =>
    geo.schedule(address, (coords) => posts.setCoordsIfAddress(id, address, coords));

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

    /** BR-POST-001 + BR-GEO-001 (geocodifica depois de responder). */
    async create(viewer, data) {
      const post = await posts.create(viewer.id, data);
      scheduleGeocoding(post.id, post.lastSeenLocation);
      return toPostDetail(post, viewer);
    },

    /** BR-GEO-002 — endereço novo apaga as coordenadas antigas e entra na fila. */
    async update(id, viewer, data) {
      const info = await assertManageable(id, viewer);
      const before = { address: info.lastSeenLocation, lat: info.lastSeenLat, lng: info.lastSeenLng };
      const moved = data.lastSeenLocation !== undefined && data.lastSeenLocation !== before.address;
      const post = await posts.update(id, moved ? { ...data, lastSeenLat: null, lastSeenLng: null } : data);
      if (geo.needsGeocoding(before, data.lastSeenLocation)) scheduleGeocoding(id, post.lastSeenLocation);
      return toPostDetail(post, viewer);
    },

    /** BR-POST-006 + BR-PHOTO-007 — os registros saem por CASCADE; os arquivos, depois. */
    async remove(id, viewer) {
      await assertManageable(id, viewer);
      const files = await photos.filenamesOf(id);
      await posts.delete(id);
      await photos.removeFiles(files);
    },

    /** BR-POST-005 — idempotente. */
    async resolve(id, viewer) {
      await assertManageable(id, viewer);
      return toPostDetail(await posts.update(id, { isResolved: true }), viewer);
    },

    /** BR-PHOTO-001..006 */
    async addPhotos(id, viewer, files) {
      await assertManageable(id, viewer);
      const { saved, rejected } = await photos.add(id, files);
      return { saved, rejected, item: await freshDetail(id, viewer) };
    },

    /** BR-PHOTO-002/007 */
    async removePhoto(id, photoId, viewer) {
      await assertManageable(id, viewer);
      await photos.remove(id, photoId);
      return freshDetail(id, viewer);
    },
  };
}
