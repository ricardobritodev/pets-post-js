/**
 * Repositório de fotos. Genérico de propósito (Q-002): os posts usam a tabela `photos`
 * (`post_id`) e a adoção (Etapa 6) vai usar `adoption_photos` com o mesmo código.
 */

/**
 * @param {import('@prisma/client').PrismaClient} db
 * @param {{ model?: string, ownerKey?: string }} options model do Prisma e nome da FK
 */
export function createPhotoRepository(db, { model = 'photo', ownerKey = 'postId' } = {}) {
  const table = db[model];
  const byOwner = (ownerId) => ({ [ownerKey]: ownerId });

  return {
    count: (ownerId) => table.count({ where: byOwner(ownerId) }),

    create: (ownerId, { filename, url, isPrimary }) =>
      table.create({ data: { ...byOwner(ownerId), filename, url, isPrimary } }),

    /** A foto só é achada se for do dono informado (foto de outro post → null → 404). */
    findForOwner: (ownerId, photoId) =>
      table.findFirst({ where: { id: photoId, ...byOwner(ownerId) }, select: { id: true, filename: true, isPrimary: true } }),

    delete: (photoId) => table.delete({ where: { id: photoId } }),

    filenamesOf: async (ownerId) =>
      (await table.findMany({ where: byOwner(ownerId), select: { filename: true } })).map((p) => p.filename),

    /** BR-PHOTO-002 — sem principal, a primeira (menor id) vira principal. */
    async promoteFirstIfNoPrimary(ownerId) {
      const hasPrimary = await table.count({ where: { ...byOwner(ownerId), isPrimary: true } });
      if (hasPrimary) return;
      const first = await table.findFirst({ where: byOwner(ownerId), orderBy: { id: 'asc' }, select: { id: true } });
      if (first) await table.update({ where: { id: first.id }, data: { isPrimary: true } });
    },
  };
}
