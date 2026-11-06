/**
 * Serviço de adoção — BR-ADOPT-*, PERM-001/002. Fotos, geocodificação e permissão vêm das
 * mesmas peças dos posts (no Flask o código era copiado).
 */
import { canView } from '@petspost/domain';
import { createManageGuard } from '../shared/access.js';
import { toAdoptionCard, toAdoptionDetail } from './presenter.js';

/**
 * @param {{
 *   adoptions: ReturnType<typeof import('./repository.js').createAdoptionRepository>,
 *   photos: ReturnType<typeof import('../photos/service.js').createPhotoService>,
 *   geo: ReturnType<typeof import('../geo/jobs.js').createGeoJobs>,
 * }} deps
 */
export function createAdoptionService({ adoptions, photos, geo }) {
  const { assertManageable, notFound } = createManageGuard(adoptions.findAccessInfo, {
    notFoundMessage: 'Anúncio de adoção não encontrado.',
    forbiddenMessage: 'Você não pode alterar este anúncio.',
  });

  const freshDetail = async (id, viewer) => toAdoptionDetail(await adoptions.findDetail(id), viewer);
  const scheduleGeocoding = (id, address) =>
    geo.schedule(address, (coords) => adoptions.setCoordsIfAddress(id, address, coords));

  return {
    checkManage: (id, viewer) => assertManageable(id, viewer),

    /** BR-ADOPT-002 */
    async list(query) {
      const page = await adoptions.listPublic(query);
      return { ...page, items: page.items.map(toAdoptionCard) };
    },

    async listMine(userId, page) {
      const result = await adoptions.listByUser(userId, page);
      return { ...result, items: result.items.map(toAdoptionCard) };
    },

    /** PERM-002 — adotado continua acessível pelo link (BR-ADOPT-003). */
    async get(id, viewer) {
      const a = id ? await adoptions.findDetail(id) : null;
      if (!a || !canView(viewer, a)) throw notFound();
      return toAdoptionDetail(a, viewer);
    },

    /** BR-ADOPT-001 + BR-GEO-001 */
    async create(viewer, data) {
      const a = await adoptions.create(viewer.id, data);
      scheduleGeocoding(a.id, a.location);
      return toAdoptionDetail(a, viewer);
    },

    /** BR-GEO-002 */
    async update(id, viewer, data) {
      const info = await assertManageable(id, viewer);
      const before = { address: info.location, lat: info.locationLat, lng: info.locationLng };
      const moved = data.location !== undefined && data.location !== before.address;
      const a = await adoptions.update(id, moved ? { ...data, locationLat: null, locationLng: null } : data);
      if (geo.needsGeocoding(before, data.location)) scheduleGeocoding(id, a.location);
      return toAdoptionDetail(a, viewer);
    },

    /** BR-PHOTO-007 */
    async remove(id, viewer) {
      await assertManageable(id, viewer);
      const files = await photos.filenamesOf(id);
      await adoptions.delete(id);
      await photos.removeFiles(files);
    },

    /** BR-ADOPT-003 — idempotente. */
    async markAdopted(id, viewer) {
      await assertManageable(id, viewer);
      return toAdoptionDetail(await adoptions.update(id, { isAdopted: true }), viewer);
    },

    async addPhotos(id, viewer, files) {
      await assertManageable(id, viewer);
      const { saved, rejected } = await photos.add(id, files);
      return { saved, rejected, item: await freshDetail(id, viewer) };
    },

    async removePhoto(id, photoId, viewer) {
      await assertManageable(id, viewer);
      await photos.remove(id, photoId);
      return freshDetail(id, viewer);
    },
  };
}
