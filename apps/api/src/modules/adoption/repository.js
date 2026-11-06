/**
 * Repositório de adoção (adoption_posts) — só acesso a dados.
 */
import { PAGE_SIZE } from '@petspost/domain';

const ORDER = [{ createdAt: 'desc' }, { id: 'desc' }];
const photoSelect = { id: true, url: true, isPrimary: true };

const cardSelect = {
  id: true,
  title: true,
  petName: true,
  petType: true,
  petSize: true,
  isNeutered: true,
  isVaccinated: true,
  location: true,
  isActive: true,
  isAdopted: true,
  createdAt: true,
  photos: { select: photoSelect, orderBy: { id: 'asc' } },
};

const detailInclude = {
  photos: { select: photoSelect, orderBy: { id: 'asc' } },
  user: { select: { id: true, name: true } },
};

/** @param {import('@prisma/client').PrismaClient} db */
export function createAdoptionRepository(db) {
  async function paginate(where, page, pageSize = PAGE_SIZE) {
    const [items, total] = await db.$transaction([
      db.adoptionPost.findMany({ where, select: cardSelect, orderBy: ORDER, skip: (page - 1) * pageSize, take: pageSize }),
      db.adoptionPost.count({ where }),
    ]);
    return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  return {
    /** BR-ADOPT-002 — públicos: ativos e não adotados. */
    listPublic: ({ petType, page }) => paginate({ isActive: true, isAdopted: false, ...(petType && { petType }) }, page),

    listByUser: (userId, page) => paginate({ userId }, page),

    findDetail: (id) => db.adoptionPost.findUnique({ where: { id }, include: detailInclude }),

    findAccessInfo: (id) =>
      db.adoptionPost.findUnique({
        where: { id },
        select: { id: true, userId: true, isActive: true, location: true, locationLat: true, locationLng: true },
      }),

    setCoordsIfAddress: async (id, address, { lat, lng }) =>
      (await db.adoptionPost.updateMany({ where: { id, location: address }, data: { locationLat: lat, locationLng: lng } })).count,

    create: (userId, data) => db.adoptionPost.create({ data: { ...data, userId }, include: detailInclude }),

    update: (id, data) => db.adoptionPost.update({ where: { id }, data, include: detailInclude }),

    /** Fotos saem por ON DELETE CASCADE. */
    delete: (id) => db.adoptionPost.delete({ where: { id } }),
  };
}
