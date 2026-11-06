/**
 * Geocodifica os anúncios ativos (posts e adoção) que estão sem coordenadas (BR-GEO-001/003).
 *   npm run geo:backfill -w @petspost/api            # mostra quantos seriam consultados
 *   npm run geo:backfill -w @petspost/api -- --apply # consulta o Nominatim (1 por segundo) e grava
 *
 * Útil para dados do seed e para anúncios antigos do Flask em que a geocodificação falhou.
 */
import { prisma } from '@petspost/db';
import { createGeocoder } from '../src/lib/geocoder.js';
import { createPostRepository } from '../src/modules/posts/repository.js';
import { createAdoptionRepository } from '../src/modules/adoption/repository.js';

const apply = process.argv.includes('--apply');
const sources = [
  {
    name: 'post',
    rows: await prisma.petPost.findMany({
      where: { isActive: true, OR: [{ lastSeenLat: null }, { lastSeenLng: null }] },
      select: { id: true, lastSeenLocation: true },
      orderBy: { id: 'asc' },
    }).then((r) => r.map((p) => ({ id: p.id, address: p.lastSeenLocation }))),
    repo: createPostRepository(prisma),
  },
  {
    name: 'adoção',
    rows: await prisma.adoptionPost.findMany({
      where: { isActive: true, OR: [{ locationLat: null }, { locationLng: null }] },
      select: { id: true, location: true },
      orderBy: { id: 'asc' },
    }).then((r) => r.map((a) => ({ id: a.id, address: a.location }))),
    repo: createAdoptionRepository(prisma),
  },
];

const total = sources.reduce((n, s) => n + s.rows.length, 0);
for (const s of sources) console.log(`${s.rows.length} ${s.name}(s) ativo(s) sem coordenadas.`);
if (!apply) {
  if (total) console.log('Rode de novo com --apply para consultar o Nominatim.');
} else {
  const geocoder = createGeocoder({ userAgent: process.env.GEOCODER_USER_AGENT, logger: { warn() {} } });
  let found = 0;
  for (const { name, rows, repo } of sources) {
    for (const { id, address } of rows) {
      const coords = await geocoder.geocode(address);
      if (coords && (await repo.setCoordsIfAddress(id, address, coords))) found += 1;
      console.log(`${name} #${id} ${coords ? `${coords.lat}, ${coords.lng}` : 'não encontrado'} · ${address}`);
    }
  }
  console.log(`${found} de ${total} geocodificado(s).`);
}
await prisma.$disconnect();
