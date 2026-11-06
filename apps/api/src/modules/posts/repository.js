/**
 * Repositório de posts (pet_posts) — só acesso a dados, sem regra de negócio.
 */
import { PAGE_SIZE } from '@petspost/domain';

const ORDER = [{ createdAt: 'desc' }, { id: 'desc' }];
const photoSelect = { id: true, url: true, isPrimary: true };

/** Campos de um card de listagem. */
const cardSelect = {
  id: true,
  title: true,
  status: true,
  petName: true,
  petType: true,
  lastSeenLocation: true,
  isActive: true,
  isResolved: true,
  createdAt: true,
  photos: { select: photoSelect, orderBy: { id: 'asc' } },
};

/** Detalhe completo (sem o email do dono). */
const detailInclude = {
  photos: { select: photoSelect, orderBy: { id: 'asc' } },
  user: { select: { id: true, name: true } },
};

/** @param {import('@prisma/client').PrismaClient} db */
export function createPostRepository(db) {
  async function paginate(where, page, pageSize = PAGE_SIZE) {
    const [items, total] = await db.$transaction([
      db.petPost.findMany({ where, select: cardSelect, orderBy: ORDER, skip: (page - 1) * pageSize, take: pageSize }),
      db.petPost.count({ where }),
    ]);
    return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  return {
    /** BR-POST-002/003 — públicos: ativos e não resolvidos. */
    listPublic: ({ status, petType, page }) =>
      paginate({ isActive: true, isResolved: false, ...(status && { status }), ...(petType && { petType }) }, page),

    /** BR-POST-004 */
    recent: (take = PAGE_SIZE) =>
      db.petPost.findMany({ where: { isActive: true, isResolved: false }, select: cardSelect, orderBy: ORDER, take }),

    /** Todos os posts de um usuário (inclui inativos e resolvidos). */
    listByUser: (userId, page) => paginate({ userId }, page),

    findDetail: (id) => db.petPost.findUnique({ where: { id }, include: detailInclude }),

    /** O mínimo para decidir permissão (e se precisa geocodificar, BR-GEO-002). */
    findAccessInfo: (id) =>
      db.petPost.findUnique({
        where: { id },
        select: { id: true, userId: true, isActive: true, lastSeenLocation: true, lastSeenLat: true, lastSeenLng: true },
      }),

    /**
     * Grava as coordenadas só se o endereço ainda for o geocodificado (a pessoa pode ter
     * editado ou excluído o post enquanto a fila andava). Devolve quantos posts mudaram (0 ou 1).
     */
    setCoordsIfAddress: async (id, address, { lat, lng }) =>
      (await db.petPost.updateMany({ where: { id, lastSeenLocation: address }, data: { lastSeenLat: lat, lastSeenLng: lng } })).count,

    create: (userId, data) => db.petPost.create({ data: { ...data, userId }, include: detailInclude }),

    update: (id, data) => db.petPost.update({ where: { id }, data, include: detailInclude }),

    /** BR-POST-006 — fotos saem por ON DELETE CASCADE. */
    delete: (id) => db.petPost.delete({ where: { id } }),
  };
}
