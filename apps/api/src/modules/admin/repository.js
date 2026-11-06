/**
 * Repositório do painel admin — consultas que só o admin faz (tudo, inclusive ocultos).
 */
import { publicUserSelect } from '../users/repository.js';

export const ADMIN_PAGE_SIZE = 20;
const ORDER = [{ createdAt: 'desc' }, { id: 'desc' }];
const photoSelect = { id: true, url: true, isPrimary: true };
const ownerSelect = { select: { id: true, name: true, email: true } };

const userSelect = { ...publicUserSelect, _count: { select: { posts: true, adoptionPosts: true } } };

const postSelect = {
  id: true, title: true, status: true, petName: true, petType: true, lastSeenLocation: true,
  isActive: true, isResolved: true, createdAt: true,
  photos: { select: photoSelect, orderBy: { id: 'asc' } },
  user: ownerSelect,
};

const adoptionSelect = {
  id: true, title: true, petName: true, petType: true, petSize: true, isNeutered: true, isVaccinated: true,
  location: true, isActive: true, isAdopted: true, createdAt: true,
  photos: { select: photoSelect, orderBy: { id: 'asc' } },
  user: ownerSelect,
};

const partnerSelect = {
  id: true, name: true, description: true, partnerType: true, address: true, lat: true, lng: true,
  phone: true, email: true, website: true, isActive: true, createdAt: true,
};

/** MySQL compara sem diferenciar maiúsculas (collation *_ci), então `contains` já serve para busca. */
const visibilityWhere = (visibility) =>
  visibility === 'active' ? { isActive: true } : visibility === 'hidden' ? { isActive: false } : {};

/** @param {import('@prisma/client').PrismaClient} db */
export function createAdminRepository(db) {
  async function paginate(model, { where, select, orderBy = ORDER, page }) {
    const [items, total] = await db.$transaction([
      db[model].findMany({ where, select, orderBy, skip: (page - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE }),
      db[model].count({ where }),
    ]);
    return { items, page, pageSize: ADMIN_PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
  }

  return {
    /** BR-ADMIN-001/004 — contagens do dashboard numa transação só. */
    async counts() {
      const live = { isActive: true, isResolved: false };
      const [
        users, activeUsers,
        posts, activePosts, resolvedPosts, lostPosts, foundPosts, hiddenPosts,
        adoptions, availableAdoptions, adopted, hiddenAdoptions,
        partners, activePartners, partnersWithoutCoords,
      ] = await db.$transaction([
        db.user.count(),
        db.user.count({ where: { isActive: true } }),
        db.petPost.count(),
        db.petPost.count({ where: live }),
        db.petPost.count({ where: { isResolved: true } }),
        db.petPost.count({ where: { ...live, status: 'lost' } }),
        db.petPost.count({ where: { ...live, status: 'found' } }),
        db.petPost.count({ where: { isActive: false } }),
        db.adoptionPost.count(),
        db.adoptionPost.count({ where: { isActive: true, isAdopted: false } }),
        db.adoptionPost.count({ where: { isAdopted: true } }),
        db.adoptionPost.count({ where: { isActive: false } }),
        db.partner.count(),
        db.partner.count({ where: { isActive: true } }),
        db.partner.count({ where: { OR: [{ lat: null }, { lng: null }] } }),
      ]);
      return {
        users: { total: users, active: activeUsers },
        posts: { total: posts, active: activePosts, resolved: resolvedPosts, lost: lostPosts, found: foundPosts, hidden: hiddenPosts },
        adoption: { total: adoptions, available: availableAdoptions, adopted, hidden: hiddenAdoptions },
        partners: { total: partners, active: activePartners, withoutCoords: partnersWithoutCoords },
      };
    },

    recent: (take = 5) =>
      Promise.all([
        db.petPost.findMany({ select: postSelect, orderBy: ORDER, take }),
        db.adoptionPost.findMany({ select: adoptionSelect, orderBy: ORDER, take }),
        db.user.findMany({ select: userSelect, orderBy: ORDER, take }),
      ]),

    // --- usuários ---
    listUsers: ({ q, page }) =>
      paginate('user', {
        where: q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {},
        select: userSelect,
        page,
      }),
    findUser: (id) => db.user.findUnique({ where: { id }, select: userSelect }),
    setUserActive: (id, isActive) => db.user.update({ where: { id }, data: { isActive }, select: userSelect }),

    // --- moderação ---
    listPosts: ({ q, visibility, status, page }) =>
      paginate('petPost', {
        where: { ...visibilityWhere(visibility), ...(status && { status }), ...(q && { title: { contains: q } }) },
        select: postSelect,
        page,
      }),
    listAdoptions: ({ q, visibility, page }) =>
      paginate('adoptionPost', {
        where: { ...visibilityWhere(visibility), ...(q && { title: { contains: q } }) },
        select: adoptionSelect,
        page,
      }),
    /** null quando não existe. */
    setPostActive: async (id, isActive) =>
      (await db.petPost.count({ where: { id } })) ? db.petPost.update({ where: { id }, data: { isActive }, select: postSelect }) : null,
    setAdoptionActive: async (id, isActive) =>
      (await db.adoptionPost.count({ where: { id } }))
        ? db.adoptionPost.update({ where: { id }, data: { isActive }, select: adoptionSelect })
        : null,

    // --- parceiros ---
    listPartners: ({ q, type, page }) =>
      paginate('partner', {
        where: { ...(type && { partnerType: type }), ...(q && { name: { contains: q } }) },
        select: partnerSelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        page,
      }),
    findPartner: (id) => db.partner.findUnique({ where: { id }, select: partnerSelect }),
    createPartner: (data) => db.partner.create({ data, select: partnerSelect }),
    updatePartner: (id, data) => db.partner.update({ where: { id }, data, select: partnerSelect }),
    deletePartner: (id) => db.partner.delete({ where: { id } }),
    countPartnerProducts: (id) => db.product.count({ where: { partnerId: id } }),
  };
}
