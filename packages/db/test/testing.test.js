// Unitário (sem banco): proteções do seed e dos testes de integração.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { databaseNameFromUrl, assertTestDatabaseUrl, assertTestDatabase } from '../src/testing.js';
import { assertDevSeedAllowed } from '../src/seed.js';

test('databaseNameFromUrl extrai o nome do banco', () => {
  assert.equal(databaseNameFromUrl('mysql://u:p@localhost:3306/petpost_v2_test?connection_limit=5'), 'petpost_v2_test');
  assert.equal(databaseNameFromUrl('mysql://u:p@localhost:3306/'), null);
  assert.equal(databaseNameFromUrl('não é url'), null);
  assert.equal(databaseNameFromUrl(undefined), null);
});

test('BR-DATA-005 só aceita banco terminado em _test', () => {
  assert.equal(assertTestDatabaseUrl('mysql://u:p@localhost/petpost_v2_test'), 'petpost_v2_test');
  for (const url of ['mysql://u:p@localhost/petpost_v2', 'mysql://u:p@localhost/test_petpost', undefined]) {
    assert.throws(() => assertTestDatabaseUrl(url), /BR-DATA-005/);
  }
});

test('BR-DATA-005 confere o banco real da conexão antes de apagar', async () => {
  const fakeDb = (name) => ({ $queryRaw: async () => [{ name }] });
  assert.equal(await assertTestDatabase(fakeDb('petpost_v2_test')), 'petpost_v2_test');
  await assert.rejects(assertTestDatabase(fakeDb('petpost_v2')), /BR-DATA-005/);
});

test('BR-DATA-002 seed de desenvolvimento recusa produção', () => {
  assert.throws(() => assertDevSeedAllowed({ NODE_ENV: 'production' }), /BR-DATA-002/);
  assert.doesNotThrow(() => assertDevSeedAllowed({ NODE_ENV: 'development' }));
  assert.doesNotThrow(() => assertDevSeedAllowed({}));
});
