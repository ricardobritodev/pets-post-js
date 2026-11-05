/**
 * testing.js — Utilitários para testes de integração (banco MySQL real).
 * Uso: import { assertTestDatabase, clearDatabase } from '@petspost/db/testing';
 *
 * BR-DATA-005: só opera em banco cujo nome termina em `_test`.
 */

/** Nome do banco a partir de uma URL mysql://user:pass@host:port/banco?params */
export function databaseNameFromUrl(url) {
  if (!url) return null;
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, '')) || null;
  } catch {
    return null;
  }
}

export const isTestDatabaseName = (name) => typeof name === 'string' && name.endsWith('_test');

/** Lança se a URL não apontar para um banco de teste. */
export function assertTestDatabaseUrl(url) {
  const name = databaseNameFromUrl(url);
  if (!isTestDatabaseName(name)) {
    throw new Error(
      `BR-DATA-005: testes de integração exigem um banco terminado em "_test" (recebido: ${name ?? 'nenhum'}). ` +
        'Configure DATABASE_URL_TEST no .env.',
    );
  }
  return name;
}

/** Confere no próprio servidor qual banco a conexão está usando. */
export async function assertTestDatabase(db) {
  const [{ name }] = await db.$queryRaw`SELECT DATABASE() AS name`;
  if (!isTestDatabaseName(name)) {
    throw new Error(`BR-DATA-005: conexão aponta para "${name}", que não é um banco de teste.`);
  }
  return name;
}

/** Apaga todos os dados (filhos antes dos pais). Só em banco de teste. */
export async function clearDatabase(db) {
  await assertTestDatabase(db);
  await db.$transaction([
    db.session.deleteMany(),
    db.photo.deleteMany(),
    db.adoptionPhoto.deleteMany(),
    db.petPost.deleteMany(),
    db.adoptionPost.deleteMany(),
    db.partner.deleteMany(),
    db.user.deleteMany(),
  ]);
}
