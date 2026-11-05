// Integração: baseline do banco Flask (BR-DATA-004) contra um dump simulado.
// Banco usado: o mesmo servidor de DATABASE_URL_TEST, banco `petpost_flask_mock_test`.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { verifyPassword, needsRehash } from '@petspost/domain';
import { assertTestDatabaseUrl } from '../src/testing.js';
import { applyBaseline, inspect } from '../src/baseline.js';

const url = (() => {
  const u = new URL(process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL);
  u.pathname = '/petpost_flask_mock_test';
  return u.toString();
})();
assertTestDatabaseUrl(url); // BR-DATA-005

const require = createRequire(import.meta.url);
const PRISMA_CLI = resolve(require.resolve('prisma/package.json'), '..', 'build/index.js');
const DUMP = resolve(import.meta.dirname, '../scripts/flask-mock/flask-mock.sql');

/** Recria o banco Flask simulado do zero (só o banco `_test`). */
function loadFlaskDump() {
  // Remove também a tabela de controle do Prisma de execuções anteriores.
  const drop = spawnSync(process.execPath, [PRISMA_CLI, 'db', 'execute', '--stdin', '--url', url], {
    input: 'DROP TABLE IF EXISTS _prisma_migrations;',
    encoding: 'utf8',
  });
  assert.equal(drop.status, 0, drop.stderr);
  const r = spawnSync(process.execPath, [PRISMA_CLI, 'db', 'execute', '--file', DUMP, '--url', url], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}

let db;
before(() => {
  loadFlaskDump();
  db = new PrismaClient({ datasourceUrl: url, log: [] });
});
after(() => db?.$disconnect());

const snapshot = async () => ({
  users: await db.user.findMany({ orderBy: { id: 'asc' } }),
  petPosts: await db.petPost.findMany({ orderBy: { id: 'asc' } }),
  photos: await db.photo.findMany({ orderBy: { id: 'asc' } }),
  adoptionPosts: await db.adoptionPost.findMany({ orderBy: { id: 'asc' } }),
  adoptionPhotos: await db.adoptionPhoto.findMany({ orderBy: { id: 'asc' } }),
  partners: await db.partner.findMany({ orderBy: { id: 'asc' } }),
  alembic: await db.$queryRawUnsafe('SELECT version_num FROM alembic_version'),
});

test('antes do baseline: banco Flask sem CASCADE impede excluir post com fotos (motivo do alinhamento)', async () => {
  assert.equal((await inspect(url)).baselined, false);
  await assert.rejects(
    db.$transaction(async (tx) => {
      await tx.petPost.delete({ where: { id: 1 } });
      throw new Error('não deveria chegar aqui');
    }),
    { code: 'P2003' },
  );
});

test('BR-DATA-004 baseline alinha a estrutura, registra 0_init e não altera nenhum dado', async () => {
  const antes = await snapshot();
  const result = await applyBaseline(url);
  assert.deepEqual(
    { ...result, remainingSql: undefined, counts: undefined },
    {
      ok: true,
      schemaInSync: true,
      remainingSql: undefined,
      migrateStatusOk: true,
      baselined: true,
      countsUnchanged: true,
      counts: undefined,
      preservedTables: ['alembic_version'],
    },
  );
  assert.deepEqual(await snapshot(), antes);
});

test('BR-DATA-004 baseline é idempotente (segunda execução não muda nada)', async () => {
  const antes = await snapshot();
  assert.equal((await applyBaseline(url)).ok, true);
  assert.deepEqual(await snapshot(), antes);
});

test('BR-DATA-004 migrations posteriores à 0_init (1_sessions) entram via deploy', async () => {
  assert.equal(await db.session.count(), 0);
  const [{ n }] = await db.$queryRawUnsafe(
    "SELECT COUNT(*) AS n FROM _prisma_migrations WHERE migration_name = '1_sessions' AND finished_at IS NOT NULL",
  );
  assert.equal(Number(n), 1);
});

test('BR-AUTH-004 senhas do banco Flask continuam válidas após o baseline', async () => {
  const byEmail = async (email) => (await db.user.findUnique({ where: { email } })).passwordHash;
  const admin = await byEmail('admin@petpost.com');
  assert.equal(await verifyPassword(admin, 'Admin@123'), true);
  assert.equal(needsRehash(admin), false);
  const legado = await byEmail('legado@exemplo.com');
  assert.equal(await verifyPassword(legado, 'Senha@123'), true);
  assert.equal(needsRehash(legado), true); // pbkdf2 → re-hash no login (Etapa 3)
});

test('BR-POST-006 depois do baseline, excluir post remove as fotos (CASCADE)', async () => {
  assert.equal(await db.photo.count({ where: { postId: 1 } }), 2);
  await db.petPost.delete({ where: { id: 1 } });
  assert.equal(await db.photo.count({ where: { postId: 1 } }), 0);
});

test('depois do baseline, inserts sem campos opcionais usam os defaults do banco', async () => {
  await db.$executeRawUnsafe(
    "INSERT INTO partners (name, partner_type, address) VALUES ('Default test', 'petshop', 'Rua X')",
  );
  const p = await db.partner.findFirst({ where: { name: 'Default test' } });
  assert.equal(p.isActive, true);
  assert.ok(p.createdAt instanceof Date);
});
