/**
 * Geocodifica os posts ativos que estão sem coordenadas (BR-GEO-001/003).
 *   npm run geo:backfill -w @petspost/api            # mostra quantos seriam consultados
 *   npm run geo:backfill -w @petspost/api -- --apply # consulta o Nominatim (1 por segundo) e grava
 *
 * Útil para posts do seed e para posts antigos do Flask em que a geocodificação falhou.
 */
import { prisma } from '@petspost/db';
import { createGeocoder } from '../src/lib/geocoder.js';
import { createPostRepository } from '../src/modules/posts/repository.js';

const apply = process.argv.includes('--apply');
const posts = await prisma.petPost.findMany({
  where: { isActive: true, OR: [{ lastSeenLat: null }, { lastSeenLng: null }] },
  select: { id: true, lastSeenLocation: true },
  orderBy: { id: 'asc' },
});
console.log(`${posts.length} post(s) ativo(s) sem coordenadas.`);
if (!apply) {
  if (posts.length) console.log('Rode de novo com --apply para consultar o Nominatim.');
} else {
  const geocoder = createGeocoder({ userAgent: process.env.GEOCODER_USER_AGENT, logger: { warn() {} } });
  const repo = createPostRepository(prisma);
  let found = 0;
  for (const { id, lastSeenLocation } of posts) {
    const coords = await geocoder.geocode(lastSeenLocation);
    if (coords && (await repo.setCoordsIfAddress(id, lastSeenLocation, coords))) found += 1;
    console.log(`#${id} ${coords ? `${coords.lat}, ${coords.lng}` : 'não encontrado'} · ${lastSeenLocation}`);
  }
  console.log(`${found} de ${posts.length} geocodificado(s).`);
}
await prisma.$disconnect();
