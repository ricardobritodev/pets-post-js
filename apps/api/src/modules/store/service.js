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
 *   importer: ReturnType<typeof import('./importer.js').createProductImporter>,
 * }} deps
 */
export function createAdminProductService({ products, photos, importer }) {
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
      return toAdminProduct(await products.create({ ...data, priceCheckedAt: new Date() })); // BR-STORE-011
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
      // BR-STORE-011: mexeu no preço → a data da consulta é agora.
      const priceTouched = data.priceCents !== undefined || data.promoPriceCents !== undefined;
      return toAdminProduct(await products.update(id, priceTouched ? { ...data, priceCheckedAt: new Date() } : data));
    },

    /** BR-STORE-009 — rascunho a partir de um link (nada é salvo). */
    importDraft: (url) => importer.draft(url),

    /** Baixa as fotos escolhidas na importação e salva como as enviadas (BR-PHOTO-*). */
    async importPhotos(id, urls) {
      await assertExists(id);
      const { files, rejected: failed } = await importer.downloadImages(urls);
      const { saved, rejected } = files.length ? await photos.add(id, files) : { saved: 0, rejected: [] };
      return { saved, rejected: [...failed, ...rejected], item: await detail(id) };
    },

    /**
     * "Atualizar do link" (BR-STORE-011): lê a página de novo e atualiza preço e disponibilidade.
     * Promoção que ficaria maior que o preço novo é apagada (BR-STORE-003).
     */
    async refresh(id) {
      const current = id ? await products.findDetail(id) : null;
      if (!current) throw notFound();
      if (!current.url) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Este produto não tem link da loja para atualizar.', [{ path: 'url', message: 'Sem link.' }]);
      }
      const page = await importer.readPage(current.url);
      const data = { priceCheckedAt: new Date() };
      const changed = {};
      if (page.priceCents != null && page.priceCents !== current.priceCents) {
        data.priceCents = page.priceCents;
        changed.priceCents = [current.priceCents, page.priceCents];
        if (current.promoPriceCents != null && current.promoPriceCents >= page.priceCents) data.promoPriceCents = null;
      }
      const wasInStock = current.stock > 0;
      if (page.inStock === false && wasInStock) {
        data.stock = 0;
        changed.inStock = [true, false];
      } else if (page.inStock === true && !wasInStock) {
        data.stock = 1; // estoque é informativo: "tem na loja"
        changed.inStock = [false, true];
      }
      return { product: toAdminProduct(await products.update(id, data)), changed };
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
