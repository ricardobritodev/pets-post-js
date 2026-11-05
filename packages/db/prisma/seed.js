/**
 * Seed de DESENVOLVIMENTO (porta de pets-post/seeds.py).
 *   npm run db:seed
 * Também é executado automaticamente pelo `prisma migrate reset` (sem --skip-seed).
 *
 * BR-DATA-002: recusa rodar com NODE_ENV=production (cria contas com senhas conhecidas).
 */
import {
  assertDevSeedAllowed,
  seedUsers,
  seedPetPosts,
  seedAdoptionPosts,
  seedPartners,
  formatResult,
} from '../src/seed.js';
import * as dev from './seed-data/dev.js';

try {
  assertDevSeedAllowed();
} catch (err) {
  console.error(`[seed] Abortado. ${err.message}`);
  process.exit(1);
}

// Importado só depois da verificação: não abre conexão se for abortar.
const { prisma } = await import('../src/index.js');

try {
  console.log('[seed] Populando banco de desenvolvimento...');
  console.log(formatResult('usuários', await seedUsers(prisma, dev.users)));
  console.log(formatResult('posts perdidos/encontrados', await seedPetPosts(prisma, dev.petPosts)));
  console.log(formatResult('anúncios de adoção', await seedAdoptionPosts(prisma, dev.adoptionPosts)));
  console.log(formatResult('parceiros', await seedPartners(prisma, dev.partners)));
  console.log(`[seed] Concluído. Admin: ${dev.DEV_ADMIN.email} / ${dev.DEV_ADMIN.password}`);
} catch (err) {
  console.error('[seed] Falhou:', err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
