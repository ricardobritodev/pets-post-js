// Integração: seeds contra MySQL real (npm run test:integration).
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { verifyPassword } from '@petspost/domain';
import { prisma } from '../src/index.js';
import { clearDatabase } from '../src/testing.js';
import { seedUsers, seedPetPosts, seedAdoptionPosts, seedPartners } from '../src/seed.js';
import * as dev from '../prisma/seed-data/dev.js';

const partnersSp = JSON.parse(await readFile(new URL('../prisma/seed-data/partners-sp.json', import.meta.url), 'utf8'));

async function seedAll() {
  return {
    users: await seedUsers(prisma, dev.users),
    petPosts: await seedPetPosts(prisma, dev.petPosts),
    adoptionPosts: await seedAdoptionPosts(prisma, dev.adoptionPosts),
    partners: await seedPartners(prisma, dev.partners),
    partnersSp: await seedPartners(prisma, partnersSp),
  };
}

before(() => clearDatabase(prisma));
after(() => prisma.$disconnect());

test('BR-DATA-001 primeira execução cria tudo; segunda não duplica nada', async () => {
  const first = await seedAll();
  assert.deepEqual(first, {
    users: { created: dev.users.length, skipped: 0 },
    petPosts: { created: dev.petPosts.length, skipped: 0 },
    adoptionPosts: { created: dev.adoptionPosts.length, skipped: 0 },
    partners: { created: dev.partners.length, skipped: 0 },
    partnersSp: { created: partnersSp.length, skipped: 0 },
  });

  const second = await seedAll();
  for (const [key, r] of Object.entries(second)) assert.equal(r.created, 0, `${key} duplicou`);

  assert.equal(await prisma.user.count(), dev.users.length);
  assert.equal(await prisma.partner.count(), dev.partners.length + partnersSp.length);
});

test('BR-DATA-003 admin de dev é admin e a senha verifica com o hash Werkzeug', async () => {
  const admin = await prisma.user.findUnique({ where: { email: dev.DEV_ADMIN.email } });
  assert.equal(admin.role, 'admin');
  assert.match(admin.passwordHash, /^scrypt:32768:8:1\$/);
  assert.equal(await verifyPassword(admin.passwordHash, dev.DEV_ADMIN.password), true);
});

test('posts do seed pertencem aos donos certos', async () => {
  const rex = await prisma.petPost.findFirst({ where: { petName: 'Rex' }, include: { user: true } });
  assert.equal(rex.user.email, 'maria@exemplo.com');
  assert.equal(rex.isActive, true);
  assert.equal(rex.isResolved, false);
});

test('BR-PARTNER-001 parceiros SP têm coordenadas (aparecem no mapa)', async () => {
  const semCoords = await prisma.partner.count({
    where: { name: { in: partnersSp.map((p) => p.name) }, OR: [{ lat: null }, { lng: null }] },
  });
  assert.equal(semCoords, 0);
});

test('seed com dono inexistente falha com mensagem clara', async () => {
  await assert.rejects(
    seedPetPosts(prisma, [{ ...dev.petPosts[0], title: 'x', ownerEmail: 'ninguem@exemplo.com' }]),
    /ninguem@exemplo\.com/,
  );
});
