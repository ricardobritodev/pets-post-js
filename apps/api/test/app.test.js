// Testa a API sem MySQL: o banco é substituído por um objeto falso.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const config = loadConfig({ NODE_ENV: 'test' });
let dbUp = true;
const fakeDb = {
  $queryRaw: async () => {
    if (!dbUp) throw new Error('down');
    return [{ 1: 1 }];
  },
};

let server;
let base;
before(async () => {
  server = createApp({ config, db: fakeDb }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('GET /api/v1/health → 200 ok', async () => {
  const res = await fetch(`${base}/api/v1/health`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'ok');
});

test('GET /api/v1/health/db → 200 quando o banco responde', async () => {
  dbUp = true;
  const res = await fetch(`${base}/api/v1/health/db`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).db, 'up');
});

test('GET /api/v1/health/db → 503 quando o banco está fora', async () => {
  dbUp = false;
  const res = await fetch(`${base}/api/v1/health/db`);
  assert.equal(res.status, 503);
  assert.equal((await res.json()).db, 'down');
});

test('rota inexistente → 404 JSON padronizado', async () => {
  const res = await fetch(`${base}/api/v1/nao-existe`);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, 'NOT_FOUND');
});

test('headers de segurança (helmet) presentes e x-powered-by ausente', async () => {
  const res = await fetch(`${base}/api/v1/health`);
  assert.ok(res.headers.get('content-security-policy'));
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('CSP libera só o necessário para as fotos (blob:) e o mapa (tiles do OSM)', async () => {
  const csp = (await fetch(`${base}/api/v1/health`)).headers.get('content-security-policy');
  const img = csp.split(';').find((d) => d.trim().startsWith('img-src'));
  assert.equal(img.trim(), "img-src 'self' data: blob: https://tile.openstreetmap.org");
  assert.match(csp, /script-src 'self'(;|$)/); // nenhum script de fora nem inline
  assert.match(csp, /default-src 'self'/);
});

test('JSON malformado → 400 INVALID_JSON', async () => {
  const res = await fetch(`${base}/api/v1/health`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{quebrado',
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVALID_JSON');
});

test('config: produção sem DATABASE_URL/SESSION_SECRET falha na inicialização', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /DATABASE_URL[\s\S]*SESSION_SECRET/);
});
