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

test('T7.8 CSP final: nada inline nem de fora, só os tiles do mapa e blob: das fotos', async () => {
  const res = await fetch(`${base}/api/v1/health`);
  const csp = Object.fromEntries(res.headers.get('content-security-policy').split(';').map((d) => {
    const [name, ...values] = d.trim().split(/\s+/);
    return [name, values.join(' ')];
  }));
  assert.equal(csp['img-src'], "'self' data: blob: https://tile.openstreetmap.org");
  assert.equal(csp['script-src'], "'self'");
  assert.equal(csp['style-src'], "'self'"); // sem 'unsafe-inline'
  assert.equal(csp['connect-src'], "'self'");
  assert.equal(csp['frame-ancestors'], "'none'");
  assert.equal(csp['object-src'], "'none'");
  assert.equal(csp['script-src-attr'], "'none'");
  assert.ok(!res.headers.get('content-security-policy').includes('unsafe'));
  // OpenStreetMap exige Referer nos tiles; só a origem vai junto
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
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
