// Integração: GET /api/v1/partners — specs/api/partners.md (BR-PARTNER-001/002/003)
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@petspost/db';
import { clearDatabase } from '@petspost/db/testing';
import { startApp, createClient, LOOSE_LIMITS } from './helpers.js';

let app;
before(async () => {
  app = await startApp({ db: prisma, limits: LOOSE_LIMITS });
});
after(async () => {
  await app?.close();
  await prisma.$disconnect();
});

// Praça da Sé como "minha localização"
const SE = { lat: -23.5505, lng: -46.6333 };
const base = { address: 'Rua X, São Paulo, SP', isActive: true };
beforeEach(async () => {
  await clearDatabase(prisma);
  await prisma.partner.createMany({
    data: [
      { ...base, name: 'Clínica Sé', partnerType: 'vet_clinic', lat: -23.5510, lng: -46.6340, phone: '(11) 98888-7777', website: 'https://clinica.com.br' },
      { ...base, name: 'Petshop Paulista', partnerType: 'petshop', lat: -23.5614, lng: -46.6559, phone: '(11) 3333-4444', website: 'javascript:alert(1)' },
      { ...base, name: 'Lar Santo André', partnerType: 'foster_home', lat: -23.6639, lng: -46.5383 }, // ~16 km
      { ...base, name: 'Abrigo Rio', partnerType: 'foster_home', lat: -22.9068, lng: -43.1729 },
      { ...base, name: 'Sem coordenada', partnerType: 'petshop', lat: null, lng: null },
      { ...base, name: 'Inativo', partnerType: 'petshop', lat: -23.55, lng: -46.63, isActive: false },
    ],
  });
});

const get = (q = '') => createClient(app.base).get(`/partners${q}`);

test('BR-PARTNER-001 só ativos com coordenadas, em ordem alfabética', async () => {
  const res = await get();
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.items.map((p) => p.name), ['Abrigo Rio', 'Clínica Sé', 'Lar Santo André', 'Petshop Paulista']);
  assert.match(res.headers.get('cache-control'), /max-age=300/);
  const clinic = res.body.items.find((p) => p.name === 'Clínica Sé');
  assert.equal(clinic.typeLabel, 'Clínica Veterinária');
  assert.equal(clinic.type, 'vet_clinic');
  assert.match(clinic.whatsappUrl, /^https:\/\/wa\.me\/5511988887777\?text=/);
  assert.equal(clinic.distanceKm, undefined);
});

test('BR-PARTNER-002 site que não é http/https não sai na API', async () => {
  const shop = (await get()).body.items.find((p) => p.name === 'Petshop Paulista');
  assert.equal(shop.website, null);
});

test('filtro por tipo; tipo inválido é ignorado', async () => {
  assert.deepEqual((await get('?type=foster_home')).body.items.map((p) => p.name), ['Abrigo Rio', 'Lar Santo André']);
  assert.equal((await get('?type=hospital')).body.items.length, 4);
});

test('BR-PARTNER-003 perto de mim: raio padrão 10 km, do mais perto ao mais longe', async () => {
  const res = await get(`?lat=${SE.lat}&lng=${SE.lng}`);
  assert.deepEqual(res.body.items.map((p) => p.name), ['Clínica Sé', 'Petshop Paulista']);
  const [first, second] = res.body.items;
  assert.ok(first.distanceKm < 0.2, `Clínica Sé a ${first.distanceKm} km`);
  assert.ok(second.distanceKm > 2.4 && second.distanceKm < 2.8, `Paulista a ${second.distanceKm} km`);

  const wider = await get(`?lat=${SE.lat}&lng=${SE.lng}&radiusKm=30`);
  assert.deepEqual(wider.body.items.map((p) => p.name), ['Clínica Sé', 'Petshop Paulista', 'Lar Santo André']);

  const fosterNear = await get(`?lat=${SE.lat}&lng=${SE.lng}&radiusKm=30&type=foster_home`);
  assert.deepEqual(fosterNear.body.items.map((p) => p.name), ['Lar Santo André']);
});

test('BR-PARTNER-003 lat sem lng, coordenada fora do mapa ou raio fora do limite → 400', async () => {
  for (const q of ['?lat=-23', '?lng=-46', '?lat=95&lng=0', '?lat=0&lng=0&radiusKm=500', '?lat=abc&lng=0']) {
    const res = await get(q);
    assert.equal(res.status, 400, q);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  }
});
