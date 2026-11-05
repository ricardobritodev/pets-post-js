/**
 * Seed de parceiros REAIS do estado de São Paulo (porta de pets-post/seeds_parceiros_sp.py).
 *   npm run db:seed:partners
 *
 * Seguro para produção: só insere parceiros cujo nome ainda não existe.
 * Coordenadas já vêm fixas no JSON — não chama o Nominatim.
 * Dados: prisma/seed-data/partners-sp.json (gerado a partir do arquivo Python).
 */
import { readFile } from 'node:fs/promises';
import { prisma } from '../src/index.js';
import { seedPartners, formatResult } from '../src/seed.js';

const partners = JSON.parse(await readFile(new URL('./seed-data/partners-sp.json', import.meta.url), 'utf8'));

try {
  console.log(`[seed] Parceiros SP (${partners.length} no arquivo)...`);
  console.log(formatResult('parceiros SP', await seedPartners(prisma, partners)));
} catch (err) {
  console.error('[seed] Falhou:', err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
