/**
 * Serviços da loja — vitrine pública (BR-STORE-001..005) e cadastro no admin (BR-STORE-006/007).
 */
import { PRODUCT_CATEGORIES, label } from '@petspost/domain';
import { HttpError } from '../../middleware/errors.js';
import { toProductCard, toProductDetail, toAdminProduct } from './presenter.js';

const notFound = () => new HttpError(404, 'NOT_FOUND', 'Produto não encontrado.');
const partnerMissing = () =>
  new HttpError(400, 'VALIDATION_ERROR', 'Parceiro não encontrado.', [{ path: 'partnerId', message: 'Parceiro não encontrado.' }]);

/** @param {{ products: ReturnType<typeof import('./repository.js').createProductRepository> }} deps */
export function createStoreService({ products }) {
  return {
    async list(query) {
      const page = await products.listPublic(query);
      return { ...page, items: page.items.map(toProductCard) };
    },

    /** BR-STORE-001 — inativo ou de parceiro inativo → 404. `viewer` existe só para casar com o webRouter. */
    async get(id) {
      const p = id ? await products.findDetail(id) : null;
      if (!p || !p.isActive || !p.partner?.isActive) throw notFound();
      return toProductDetail(p);
    },

    async categories() {
      const counts = new Map(await products.categoryCounts());
      return { items: PRODUCT_CATEGORIES.map((value) => ({ value, label: label('productCategory', value), count: counts.get(value) ?? 0 })) };
    },
  };
}

/**
 * @param {{
 *   products: ReturnType<typeof import('./repository.js').createProductRepository>,
 *   photos: ReturnType<typeof import('../photos/service.js').createPhotoService>,
 * }} deps
 */
export function createAdminProductService({ products, photos }) {
  const detail = async (id) => {
    const p = await products.findDetail(id);
    if (!p) throw notFound();
    return toAdminProduct(p);
  };
  const assertExists = async (id) => {
    if (!id || !(await products.exists(id))) throw notFound();
  };

  return {
    list: async (query) => {
      const page = await products.listAdmin(query);
      return { ...page, items: page.items.map(toAdminProduct) };
    },
    get: (id) => (id ? detail(id) : Promise.reject(notFound())),

    async create(data) {
      if (!(await products.partnerExists(data.partnerId))) throw partnerMissing();
      return toAdminProduct(await products.create(data));
    },

    async update(id, data) {
      await assertExists(id);
      if (data.partnerId !== undefined && !(await products.partnerExists(data.partnerId))) throw partnerMissing();
      // BR-STORE-003: promoção que não vem no PATCH ainda precisa ficar menor que um preço novo.
      if (data.priceCents !== undefined && data.promoPriceCents === undefined) {
        const current = await products.findDetail(id);
        if (current.promoPriceCents != null && current.promoPriceCents >= data.priceCents) {
          throw new HttpError(400, 'VALIDATION_ERROR', 'O preço promocional precisa ser menor que o preço.',
            [{ path: 'promoPriceCents', message: 'O preço promocional precisa ser menor que o preço.' }]);
        }
      }
      return toAdminProduct(await products.update(id, data));
    },

    /** BR-PHOTO-007 — fotos e arquivos saem junto. */
    async remove(id) {
      await assertExists(id);
      const files = await photos.filenamesOf(id);
      await products.delete(id);
      await photos.removeFiles(files);
    },

    // Interface das rotas de fotos (mountPhotoRoutes). O router já exige admin.
    checkManage: (id) => assertExists(id),
    async addPhotos(id, _viewer, files) {
      await assertExists(id);
      const { saved, rejected } = await photos.add(id, files);
      return { saved, rejected, item: await detail(id) };
    },
    async removePhoto(id, photoId) {
      await assertExists(id);
      await photos.remove(id, photoId);
      return detail(id);
    },
  };
}
