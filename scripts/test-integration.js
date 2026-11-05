/**
 * Roda os testes de integração contra um MySQL real.
 *   npm run test:integration
 *
 * 1. Valida DATABASE_URL_TEST (BR-DATA-005: o banco precisa terminar em `_test`).
 * 2. Aplica as migrations pendentes no banco de teste (`prisma migrate deploy`, não destrutivo).
 *    Cada arquivo de teste limpa os dados que usa com `clearDatabase` (@petspost/db/testing).
 *    Para recriar o banco do zero (ex.: após mexer no schema), rode manualmente:
 *      DATABASE_URL=$DATABASE_URL_TEST npx prisma migrate reset --skip-seed   (em packages/db)
 * 3. Roda `node --test` nos arquivos `integration/**\/*.int.js` de todos os workspaces,
 *    um arquivo por vez (eles compartilham o mesmo banco).
 *
 * Os testes unitários (`npm test`) continuam sem precisar de banco: os arquivos
 * `*.int.js` não casam com o padrão padrão do `node --test`.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { assertTestDatabaseUrl } from '../packages/db/src/testing.js';

const root = resolve(import.meta.dirname, '..');
const url = process.env.DATABASE_URL_TEST;

let dbName;
try {
  dbName = assertTestDatabaseUrl(url);
} catch (err) {
  console.error(`[test:integration] ${err.message}`);
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: url, NODE_ENV: 'test' };
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env, cwd: root, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

console.log(`[test:integration] Aplicando migrations em "${dbName}"...`);
run('npx', ['prisma', 'migrate', 'deploy'], {
  cwd: resolve(root, 'packages/db'),
});

const extra = process.argv.slice(2); // ex.: --test-name-pattern="BR-DATA"
run(process.execPath, [
  '--test',
  '--test-concurrency=1',
  ...extra,
  'packages/*/integration/**/*.int.js',
  'apps/*/integration/**/*.int.js',
]);
