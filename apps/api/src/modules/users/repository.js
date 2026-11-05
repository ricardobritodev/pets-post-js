/**
 * Repositório de usuários — só acesso a dados (Prisma), sem regra de negócio.
 * ADR 001: router → service → repositório. O client é injetado (testável).
 *
 * `passwordHash` nunca sai deste módulo nas leituras comuns (entities.md:
 * "nunca exposto"). Só `findByEmailWithHash` o devolve, para o login (Etapa 3).
 */

/** Campos seguros para devolver à API. */
export const publicUserSelect = Object.freeze({
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  avatarUrl: true,
  isActive: true,
  createdAt: true,
});

/** @param {import('@prisma/client').PrismaClient} db */
export function createUserRepository(db) {
  return {
    findById: (id) => db.user.findUnique({ where: { id }, select: publicUserSelect }),

    findByEmail: (email) => db.user.findUnique({ where: { email }, select: publicUserSelect }),

    /** Inclui o hash — uso exclusivo da autenticação. */
    findByEmailWithHash: (email) =>
      db.user.findUnique({ where: { email }, select: { ...publicUserSelect, passwordHash: true } }),

    existsByEmail: async (email) => (await db.user.count({ where: { email } })) > 0,

    /** @param {{ name: string, email: string, passwordHash: string, phone?: string|null, role?: 'admin'|'user' }} data */
    create: (data) => db.user.create({ data, select: publicUserSelect }),

    update: (id, data) => db.user.update({ where: { id }, data, select: publicUserSelect }),

    updatePasswordHash: (id, passwordHash) =>
      db.user.update({ where: { id }, data: { passwordHash }, select: { id: true } }),

    setActive: (id, isActive) => db.user.update({ where: { id }, data: { isActive }, select: publicUserSelect }),

    /** Listagem paginada (mais recentes primeiro) — formato de specs/api/conventions.md. */
    async list({ page = 1, pageSize = 12 } = {}) {
      const [items, total] = await db.$transaction([
        db.user.findMany({
          select: publicUserSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        db.user.count(),
      ]);
      return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
    },
  };
}
