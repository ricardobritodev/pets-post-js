// Integração: repositório de usuários contra MySQL real (npm run test:integration).
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@petspost/db';
import { clearDatabase } from '@petspost/db/testing';
import { hashPassword, verifyPassword } from '@petspost/domain';
import { createUserRepository } from '../src/modules/users/repository.js';

const users = createUserRepository(prisma);
let hash;

before(async () => {
  hash = await hashPassword('Senha@123');
});
beforeEach(() => clearDatabase(prisma));
after(() => prisma.$disconnect());

const newUser = (over = {}) => ({ name: 'Maria', email: 'maria@exemplo.com', passwordHash: hash, ...over });

test('create aplica defaults do banco (role=user, isActive=true) e não devolve o hash', async () => {
  const u = await users.create(newUser());
  assert.equal(u.role, 'user');
  assert.equal(u.isActive, true);
  assert.ok(u.createdAt instanceof Date);
  assert.equal('passwordHash' in u, false);
});

test('findById / findByEmail não expõem passwordHash', async () => {
  const { id } = await users.create(newUser());
  for (const u of [await users.findById(id), await users.findByEmail('maria@exemplo.com')]) {
    assert.equal(u.id, id);
    assert.equal('passwordHash' in u, false);
  }
  assert.equal(await users.findById(999_999), null);
});

test('BR-AUTH-004 findByEmailWithHash devolve hash que verifica a senha', async () => {
  await users.create(newUser());
  const u = await users.findByEmailWithHash('maria@exemplo.com');
  assert.equal(await verifyPassword(u.passwordHash, 'Senha@123'), true);
});

test('BR-AUTH-001 email é único no banco (P2002)', async () => {
  await users.create(newUser());
  assert.equal(await users.existsByEmail('maria@exemplo.com'), true);
  await assert.rejects(users.create(newUser({ name: 'Outra' })), { code: 'P2002' });
});

test('update, setActive e updatePasswordHash', async () => {
  const { id } = await users.create(newUser());
  assert.equal((await users.update(id, { phone: '(11) 98765-4321' })).phone, '(11) 98765-4321');
  assert.equal((await users.setActive(id, false)).isActive, false);
  const novo = await hashPassword('OutraSenha1');
  await users.updatePasswordHash(id, novo);
  assert.equal((await users.findByEmailWithHash('maria@exemplo.com')).passwordHash, novo);
});

test('list pagina no formato da convenção da API', async () => {
  for (let i = 0; i < 3; i++) await users.create(newUser({ email: `u${i}@exemplo.com` }));
  const p1 = await users.list({ page: 1, pageSize: 2 });
  assert.deepEqual({ ...p1, items: p1.items.length }, { items: 2, page: 1, pageSize: 2, total: 3, totalPages: 2 });
  const p2 = await users.list({ page: 2, pageSize: 2 });
  assert.equal(p2.items.length, 1);
  assert.equal(p2.items[0].email, 'u0@exemplo.com'); // mais antigo por último
});
