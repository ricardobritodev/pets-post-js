/**
 * Repositório da loja (products / product_photos).
 */
import { STORE_PAGE_SIZE, finalPriceCents } from '@petspost/domain';
import { ADMIN_PAGE_SIZE } from '../admin/repository.js';

const photoSelect = { id: true, url: true, isPrimary: true };
const partnerSelect = {
  select: { id: true, name: true, partnerType: true, address: true, phone: true, website: true, isActive: true },
};
const cardSelect = {
  id: true, name: true, category: true, petType: true, priceCents: true, promoPriceCents: true, stock: true,
  isActive: true, isFeatured: true, priceCheckedAt: true, createdAt: true, partnerId: true, sellerName: true,
  photos: { select: photoSelect, orderBy: { id: 'asc' } },
  partner: partnerSelect,
};
const detailSelect = { ...cardSelect, description: true, url: true, updatedAt: true };

/** BR-STORE-001 — visível = ativo e de parceiro ativo. */
const VISIBLE = { isActive: true, partner: { isActive: true } };

function publicWhere({ q, category, petType, partnerId }) {
  return {
    ...VISIBLE,
    ...(category && { category }),
    // produto "para todos" (sem tipo) aparece em qualquer filtro de animal
    ...(petType && { OR: [{ petType }, { petType: null }] }),
    ...(partnerId && { partnerId }),
    ...(q && { name: { contains: q } }),
  };
}

const ORDER = {
  featured: [{ isFeatured: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
};

/** @param {import('@prisma/client').PrismaClient} db */
export function createProductRepository(db) {
  const pageOf = (items, page, pageSize, total) =>
    ({ items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });

  return {
    /**
     * Vitrine. Ordenar pelo preço *final* (com promoção) não dá para fazer só com o Prisma; como a
     * vitrine tem poucas centenas de produtos, a ordem por preço é calculada aqui e só a página vem completa.
     */
    async listPublic(query) {
      const where = publicWhere(query);
      const { page, sort } = query;
      const skip = (page - 1) * STORE_PAGE_SIZE;
      if (sort === 'price_asc' || sort === 'price_desc') {
        const all = await db.product.findMany({ where, select: { id: true, priceCents: true, promoPriceCents: true } });
        const dir = sort === 'price_asc' ? 1 : -1;
        all.sort((a, b) => dir * (finalPriceCents(a) - finalPriceCents(b)) || a.id - b.id);
        const ids = all.slice(skip, skip + STORE_PAGE_SIZE).map((p) => p.id);
        const rows = await db.product.findMany({ where: { id: { in: ids } }, select: cardSelect });
        const byId = new Map(rows.map((r) => [r.id, r]));
        return pageOf(ids.map((id) => byId.get(id)), page, STORE_PAGE_SIZE, all.length);
      }
      const [items, total] = await db.$transaction([
        db.product.findMany({ where, select: cardSelect, orderBy: ORDER[sort] ?? ORDER.featured, skip, take: STORE_PAGE_SIZE }),
        db.product.count({ where }),
      ]);
      return pageOf(items, page, STORE_PAGE_SIZE, total);
    },

    findDetail: (id) => db.product.findUnique({ where: { id }, select: detailSelect }),

    /** Contagem por categoria do que está visível. */
    categoryCounts: async () =>
      (await db.product.groupBy({ by: ['category'], where: VISIBLE, _count: { _all: true } }))
        .map((g) => [g.category, g._count._all]),

    // --- admin ---
    listAdmin: async ({ q, category, partnerId, visibility, page }) => {
      const where = {
        ...(category && { category }),
        ...(partnerId && { partnerId }),
        ...(visibility === 'active' && { isActive: true }),
        ...(visibility === 'hidden' && { isActive: false }),
        ...(q && { name: { contains: q } }),
      };
      const [items, total] = await db.$transaction([
        db.product.findMany({ where, select: detailSelect, orderBy: ORDER.newest, skip: (page - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE }),
        db.product.count({ where }),
      ]);
      return pageOf(items, page, ADMIN_PAGE_SIZE, total);
    },
    exists: async (id) => (await db.product.count({ where: { id } })) > 0,
    partnerExists: async (id) => (await db.partner.count({ where: { id } })) > 0,
    /** BR-STORE-012 — parceiros para achar a loja pelo site ou pelo nome (são poucas dezenas). */
    partnersForMatching: () => db.partner.findMany({
      select: { id: true, name: true, website: true, isActive: true }, orderBy: { id: 'asc' },
    }),
    /** BR-STORE-012 — loja online: sem coordenadas, então não aparece no mapa. */
    createOnlinePartner: ({ name, website }) => db.partner.create({
      data: { name, website, partnerType: 'petshop', address: 'Loja online', description: 'Loja online cadastrada ao importar um produto.' },
      select: { id: true },
    }),
    create: (data) => db.product.create({ data, select: detailSelect }),
    update: (id, data) => db.product.update({ where: { id }, data, select: detailSelect }),
    delete: (id) => db.product.delete({ where: { id } }),
  };
}
