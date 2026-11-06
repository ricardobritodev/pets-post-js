// Integração: geocodificação dos posts e rota de CEP — specs/api/geo.md (BR-GEO-001..004)
// Nominatim e ViaCEP são falsos aqui (sem rede); o banco é o MySQL de teste.
import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@petspost/db';
import { clearDatabase } from '@petspost/db/testing';
import { hashPassword } from '@petspost/domain';
import { UpstreamError } from '../src/lib/cep.js';
import { startApp, createClient, LOOSE_LIMITS } from './helpers.js';

/** Geocoder falso: guarda os pedidos e responde pelo mapa (ou com o que o teste mandar). */
function fakeGeocoder(answers = {}) {
  const calls = [];
  return {
    calls,
    respond: null, // (address) => Promise
    async geocode(address) {
      calls.push(address);
      if (this.respond) return this.respond(address);
      return answers[address] ?? null;
    },
  };
}

const ADDRESS_A = 'Parque Ibirapuera, São Paulo, SP';
const ADDRESS_B = 'Praça Osório, Curitiba, PR';
const geocoder = fakeGeocoder({ [ADDRESS_A]: { lat: -23.587416, lng: -46.657634 }, [ADDRESS_B]: { lat: -25.432956, lng: -49.27965 } });

const cepCalls = [];
const cep = {
  async lookup(digits) {
    cepCalls.push(digits);
    if (digits === '01310100') return { cep: '01310-100', street: 'Avenida Paulista', neighborhood: 'Bela Vista', city: 'São Paulo', uf: 'SP' };
    if (digits === '50000000') throw new UpstreamError('fora do ar');
    return null;
  },
};

let app;
let maria;
before(async () => {
  app = await startApp({ db: prisma, limits: LOOSE_LIMITS, geocoder, cep });
});
after(async () => {
  await app?.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await clearDatabase(prisma);
  geocoder.calls.length = 0;
  geocoder.respond = null;
  cepCalls.length = 0;
  maria = await prisma.user.create({ data: { name: 'Maria', email: 'maria@exemplo.com', passwordHash: await hashPassword('Senha@123') } });
});

const body = (over = {}) => ({
  title: 'Cachorro perdido',
  description: 'Fugiu.',
  status: 'lost',
  petType: 'dog',
  lastSeenLocation: ADDRESS_A,
  contactPhone: '(11) 98765-4321',
  ...over,
});
const login = () => createClient(app.base).loginAs('maria@exemplo.com');
const coordsOf = async (id) => {
  const p = await prisma.petPost.findUnique({ where: { id }, select: { lastSeenLat: true, lastSeenLng: true } });
  return [p.lastSeenLat, p.lastSeenLng];
};

describe('geocodificação dos posts', () => {
  test('BR-GEO-001 criar responde sem coordenadas e grava depois, em DOUBLE (M-01)', async () => {
    const c = await login();
    const res = await c.post('/posts', body());
    assert.equal(res.status, 201);
    assert.equal(res.body.post.lastSeenLat, null); // respondeu antes de geocodificar
    await app.geo.idle();
    assert.deepEqual(geocoder.calls, [ADDRESS_A]);
    // DOUBLE guarda as 6 casas; o FLOAT antigo arredondava para ~-23.5874
    assert.deepEqual(await coordsOf(res.body.post.id), [-23.587416, -46.657634]);
    const detail = await c.get(`/posts/${res.body.post.id}`);
    assert.equal(detail.body.post.lastSeenLat, -23.587416);
  });

  test('BR-GEO-001 endereço que o Nominatim não acha fica sem coordenadas', async () => {
    const c = await login();
    const res = await c.post('/posts', body({ lastSeenLocation: 'Lugar que não existe' }));
    await app.geo.idle();
    assert.equal(geocoder.calls.length, 1);
    assert.deepEqual(await coordsOf(res.body.post.id), [null, null]);
  });

  test('BR-GEO-002 editar outro campo não geocodifica de novo', async () => {
    const post = await prisma.petPost.create({ data: { ...body(), userId: maria.id, lastSeenLat: -1, lastSeenLng: -2 } });
    const c = await login();
    await c.patch(`/posts/${post.id}`, { title: 'Novo título' });
    await c.patch(`/posts/${post.id}`, { lastSeenLocation: ADDRESS_A }); // mesmo endereço
    await app.geo.idle();
    assert.deepEqual(geocoder.calls, []);
    assert.deepEqual(await coordsOf(post.id), [-1, -2]);
  });

  test('BR-GEO-002 endereço novo apaga as coordenadas na hora e geocodifica', async () => {
    const post = await prisma.petPost.create({ data: { ...body(), userId: maria.id, lastSeenLat: -1, lastSeenLng: -2 } });
    const c = await login();
    const res = await c.patch(`/posts/${post.id}`, { lastSeenLocation: ADDRESS_B });
    assert.equal(res.body.post.lastSeenLat, null);
    assert.equal(res.body.post.lastSeenLng, null);
    await app.geo.idle();
    assert.deepEqual(geocoder.calls, [ADDRESS_B]);
    assert.deepEqual(await coordsOf(post.id), [-25.432956, -49.27965]);
  });

  test('BR-GEO-002 post sem coordenadas tenta de novo em qualquer edição', async () => {
    const post = await prisma.petPost.create({ data: { ...body(), userId: maria.id } });
    const c = await login();
    await c.patch(`/posts/${post.id}`, { title: 'Outro' });
    await app.geo.idle();
    assert.deepEqual(geocoder.calls, [ADDRESS_A]);
    assert.deepEqual(await coordsOf(post.id), [-23.587416, -46.657634]);
  });

  test('BR-GEO-002 resultado atrasado de um endereço antigo é descartado', async () => {
    const c = await login();
    let release;
    geocoder.respond = (address) =>
      address === ADDRESS_A ? new Promise((r) => { release = () => r({ lat: 1, lng: 1 }); }) : Promise.resolve({ lat: 2, lng: 2 });

    const res = await c.post('/posts', body()); // geocodificação de A fica "presa"
    const id = res.body.post.id;
    await c.patch(`/posts/${id}`, { lastSeenLocation: ADDRESS_B }); // B termina antes
    await new Promise((r) => setImmediate(r));
    release(); // A chega atrasado
    await app.geo.idle();
    assert.deepEqual(await coordsOf(id), [2, 2]);
  });

  test('BR-GEO-001 post excluído antes da geocodificação terminar não dá erro', async () => {
    const c = await login();
    let release;
    geocoder.respond = () => new Promise((r) => { release = () => r({ lat: 1, lng: 1 }); });
    const res = await c.post('/posts', body());
    assert.equal((await c.del(`/posts/${res.body.post.id}`)).status, 204);
    release();
    await app.geo.idle();
    assert.equal(await prisma.petPost.count(), 0);
  });
});

describe('GET /cep/:cep', () => {
  test('BR-GEO-004 devolve o endereço; máscara é ignorada', async () => {
    const res = await createClient(app.base).get('/cep/01310-100');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { cep: '01310-100', street: 'Avenida Paulista', neighborhood: 'Bela Vista', city: 'São Paulo', uf: 'SP' });
    assert.deepEqual(cepCalls, ['01310100']);
    assert.match(res.headers.get('cache-control'), /max-age=86400/);
  });

  test('BR-GEO-004 formato inválido → 400 sem consultar o ViaCEP', async () => {
    const res = await createClient(app.base).get('/cep/1234');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.deepEqual(cepCalls, []);
  });

  test('BR-GEO-004 inexistente → 404; ViaCEP fora → 502', async () => {
    const notFound = await createClient(app.base).get('/cep/99999999');
    assert.equal(notFound.status, 404);
    assert.equal(notFound.body.error.code, 'NOT_FOUND');
    const down = await createClient(app.base).get('/cep/50000-000');
    assert.equal(down.status, 502);
    assert.equal(down.body.error.code, 'UPSTREAM_ERROR');
  });

  test('BR-GEO-004 limite de 30/min por IP → 429', async () => {
    const { DEFAULT_LIMITS } = await import('../src/middleware/rate-limit.js');
    assert.deepEqual(DEFAULT_LIMITS.cep, { perMinute: 30, perHour: 300 });
    const strict = await startApp({ db: prisma, limits: { ...LOOSE_LIMITS, cep: { perMinute: 2, perHour: 10 } }, cep, geocoder: null });
    try {
      const c = createClient(strict.base);
      assert.equal((await c.get('/cep/01310100')).status, 200);
      assert.equal((await c.get('/cep/01310100')).status, 200);
      const blocked = await c.get('/cep/01310100');
      assert.equal(blocked.status, 429);
      assert.equal(blocked.body.error.code, 'RATE_LIMITED');
    } finally {
      await strict.close();
    }
  });
});
