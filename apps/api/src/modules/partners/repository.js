/**
 * Repositório de parceiros — leitura pública do mapa (BR-PARTNER-001).
 */
const select = {
  id: true, name: true, description: true, partnerType: true, address: true,
  lat: true, lng: true, phone: true, email: true, website: true,
};

/** @param {import('@prisma/client').PrismaClient} db */
export function createPartnerRepository(db) {
  return {
    /**
     * Ativos **com** coordenadas. `box` (opcional) recorta um retângulo antes do cálculo exato.
     * @param {{ type?: string, box?: { minLat: number, maxLat: number, minLng: number, maxLng: number } }} filters
     */
    listForMap: ({ type, box } = {}) =>
      db.partner.findMany({
        where: {
          isActive: true,
          lat: box ? { gte: box.minLat, lte: box.maxLat } : { not: null },
          lng: box ? { gte: box.minLng, lte: box.maxLng } : { not: null },
          ...(type && { partnerType: type }),
        },
        select,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
  };
}
