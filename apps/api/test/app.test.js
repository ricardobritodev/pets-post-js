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

test('BR-CONTACT-002 GET /site sem número configurado → whatsappUrl null', async () => {
  const res = await fetch(`${base}/api/v1/site`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { contact: { whatsappUrl: null } });
  assert.match(res.headers.get('cache-control'), /max-age=300/);
  assert.equal(res.headers.get('set-cookie'), null); // não cria sessão
});

test('BR-CONTACT-002 número configurado vira link wa.me com a mensagem padrão (ou a configurada)', async () => {
  const cfg = loadConfig({ NODE_ENV: 'test', CONTACT_WHATSAPP: '(11) 91234-5678' });
  // codificação igual à do urllib.parse.quote do Flask (BR-CONTACT-001): "!" vira %21
  assert.equal(cfg.CONTACT_WHATSAPP_URL, 'https://wa.me/5511912345678?text=Ol%C3%A1%21%20Vim%20pelo%20site%20do%20Pets%20Post%20e%20gostaria%20de%20ajuda.');
  const custom = loadConfig({ NODE_ENV: 'test', CONTACT_WHATSAPP: '5511912345678', CONTACT_WHATSAPP_MESSAGE: 'Oi, quero ajuda' });
  assert.equal(custom.CONTACT_WHATSAPP_URL, 'https://wa.me/5511912345678?text=Oi%2C%20quero%20ajuda');

  const srv = createApp({ config: cfg, db: fakeDb }).listen(0);
  await new Promise((r) => srv.once('listening', r));
  try {
    const body = await (await fetch(`http://127.0.0.1:${srv.address().port}/api/v1/site`)).json();
    assert.equal(body.contact.whatsappUrl, cfg.CONTACT_WHATSAPP_URL);
  } finally {
    srv.close();
  }
});

test('BR-CONTACT-002 número inválido impede a API de subir, com mensagem clara', () => {
  for (const bad of ['0800 123 4567', '9999-9999', 'abc']) {
    assert.throws(() => loadConfig({ NODE_ENV: 'test', CONTACT_WHATSAPP: bad }), /CONTACT_WHATSAPP: número inválido/, bad);
  }
});
