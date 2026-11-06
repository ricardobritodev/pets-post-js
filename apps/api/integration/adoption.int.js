// Integração: /api/v1/adoption contra MySQL real — specs/api/adoption.md (BR-ADOPT-001..004)
import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { prisma } from '@petspost/db';
import { clearDatabase } from '@petspost/db/testing';
import { hashPassword } from '@petspost/domain';
import { createDiskStorage } from '../src/lib/storage.js';
import { startApp, createClient, LOOSE_LIMITS } from './helpers.js';

const geocoder = {
  calls: [],
  async geocode(address) {
    this.calls.push(address);
    return { lat: -23.561, lng: -46.691 };
  },
};

let app;
let dir;
let hash;
let maria;
let admin;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'petspost-adoption-'));
  app = await startApp({ db: prisma, limits: LOOSE_LIMITS, storage: createDiskStorage({ dir }), geocoder });
  hash = await hashPassword('Senha@123');
});
after(async () => {
  await app?.close();
  await prisma.$disconnect();
  if (dir) await rm(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  await clearDatabase(prisma);
  geocoder.calls.length = 0;
  for (const f of await readdir(dir)) await rm(join(dir, f));
  const mk = (name, email, role = 'user') => prisma.user.create({ data: { name, email, role, passwordHash: hash } });
  [maria, , admin] = await Promise.all([
    mk('Maria Silva', 'maria@exemplo.com'),
    mk('Carlos', 'carlos@exemplo.com'),
    mk('Admin', 'admin@exemplo.com', 'admin'),
  ]);
});

const body = (over = {}) => ({
  title: 'Gatinha Mel para adoção',
  description: 'Muito carinhosa, 1 ano.',
  petType: 'cat',
  location: 'Pinheiros, São Paulo, SP',
  contactPhone: '(11) 98765-4321',
  ...over,
});
let seq = 0;
const mkAdoption = (over = {}) =>
  prisma.adoptionPost.create({
    data: { ...body(), userId: maria.id, createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, seq++)), ...over },
  });
const anon = () => createClient(app.base);
const as = (email) => createClient(app.base).loginAs(email);

describe('GET /adoption (lista pública)', () => {
  test('BR-ADOPT-002 só ativos e não adotados, mais novos primeiro, filtro por tipo', async () => {
    const cat = await mkAdoption({ title: 'gato' });
    const dog = await mkAdoption({ title: 'cão', petType: 'dog' });
    await mkAdoption({ title: 'adotado', isAdopted: true });
    await mkAdoption({ title: 'oculto', isActive: false });

    const all = await anon().get('/adoption');
    assert.equal(all.status, 200);
    assert.deepEqual(all.body.items.map((i) => i.id), [dog.id, cat.id]);
    assert.equal(all.body.pageSize, 12);

    const dogs = await anon().get('/adoption?pet_type=dog'); // link antigo
    assert.deepEqual(dogs.body.items.map((i) => i.id), [dog.id]);
    const invalid = await anon().get('/adoption?petType=peixe');
    assert.equal(invalid.body.items.length, 2); // inválido é ignorado
  });

  test('BR-ADOPT-002 12 por página', async () => {
    for (let i = 0; i < 13; i++) await mkAdoption({ title: `a${i}` });
    const p2 = await anon().get('/adoption?page=2');
    assert.equal(p2.body.items.length, 1);
    assert.equal(p2.body.totalPages, 2);
  });

  test('BR-ADOPT-004 card traz castrado, vacinado e porte', async () => {
    await mkAdoption({ isNeutered: true, isVaccinated: false, petSize: 'small' });
    const [card] = (await anon().get('/adoption')).body.items;
    assert.equal(card.isNeutered, true);
    assert.equal(card.isVaccinated, false);
    assert.equal(card.petSizeLabel, 'Pequeno');
    assert.equal(card.petTypeLabel, 'Gato');
    assert.equal(card.primaryPhoto, null);
  });
});

describe('GET /adoption/:id', () => {
  test('detalhe com WhatsApp e sem o email do dono; inativo → 404 para outros (PERM-002)', async () => {
    const a = await mkAdoption({ petName: 'Mel', adopterRequirements: 'Casa com tela' });
    const res = await anon().get(`/adoption/${a.id}`);
    assert.equal(res.status, 200);
    const { adoption } = res.body;
    assert.equal(adoption.adopterRequirements, 'Casa com tela');
    assert.equal(adoption.owner.name, 'Maria Silva');
    assert.equal(adoption.canManage, false);
    assert.match(decodeURIComponent(adoption.whatsappUrl), /\*Mel\* está para adoção/);
    assert.ok(!JSON.stringify(adoption).includes('maria@exemplo.com'));

    const hidden = await mkAdoption({ isActive: false });
    assert.equal((await anon().get(`/adoption/${hidden.id}`)).status, 404);
    assert.equal((await (await as('carlos@exemplo.com')).get(`/adoption/${hidden.id}`)).status, 404);
    assert.equal((await (await as('maria@exemplo.com')).get(`/adoption/${hidden.id}`)).status, 200);
    assert.equal((await (await as('admin@exemplo.com')).get(`/adoption/${hidden.id}`)).status, 200);
    assert.equal((await anon().get('/adoption/abc')).status, 404);
  });

  test('BR-ADOPT-003 adotado continua acessível pelo link', async () => {
    const a = await mkAdoption({ isAdopted: true });
    const res = await anon().get(`/adoption/${a.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.adoption.isAdopted, true);
  });
});

describe('escrita', () => {
  test('BR-ADOPT-001 criar: obrigatórios, defaults false e geocodificação depois', async () => {
    const c = await as('maria@exemplo.com');
    const bad = await c.post('/adoption', { title: '' });
    assert.equal(bad.status, 400);
    const fields = bad.body.error.details.map((d) => d.path).sort();
    assert.deepEqual(fields, ['contactPhone', 'description', 'location', 'petType', 'title']);

    const res = await c.post('/adoption', body({ isNeutered: 'on' }));
    assert.equal(res.status, 201);
    assert.equal(res.body.adoption.isNeutered, true);
    assert.equal(res.body.adoption.isVaccinated, false);
    assert.equal(res.body.adoption.canManage, true);
    assert.equal(res.body.adoption.locationLat, null);
    await app.geo.idle();
    assert.deepEqual(geocoder.calls, ['Pinheiros, São Paulo, SP']); // mesma fila dos posts
    const saved = await prisma.adoptionPost.findUnique({ where: { id: res.body.adoption.id } });
    assert.equal(saved.locationLat, -23.561);
  });

  test('criar sem login → 401; sem CSRF → 403', async () => {
    assert.equal((await (await anon().init()).post('/adoption', body())).status, 401);
    const c = await as('maria@exemplo.com');
    assert.equal((await c.post('/adoption', body(), { csrf: false })).status, 403);
  });

  test('PERM-001 editar: dono e admin sim; outra pessoa 403; inativo de outra 404', async () => {
    const a = await mkAdoption();
    const hidden = await mkAdoption({ isActive: false });
    const carlos = await as('carlos@exemplo.com');
    assert.equal((await carlos.patch(`/adoption/${a.id}`, { title: 'x' })).status, 403);
    assert.equal((await carlos.patch(`/adoption/${hidden.id}`, { title: 'x' })).status, 404);
    const maria = await as('maria@exemplo.com');
    const ok = await maria.patch(`/adoption/${a.id}`, { isVaccinated: true });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.adoption.isVaccinated, true);
    assert.equal(ok.body.adoption.isNeutered, false); // campo ausente não muda
    const adm = await as('admin@exemplo.com');
    assert.equal((await adm.patch(`/adoption/${a.id}`, { title: 'Pelo admin' })).body.adoption.title, 'Pelo admin');
    assert.equal((await maria.patch(`/adoption/${a.id}`, {})).status, 400);
  });

  test('BR-GEO-002 endereço novo apaga as coordenadas e geocodifica de novo', async () => {
    const a = await mkAdoption({ locationLat: -1, locationLng: -2 });
    const c = await as('maria@exemplo.com');
    await c.patch(`/adoption/${a.id}`, { title: 'Só o título' });
    await app.geo.idle();
    assert.equal(geocoder.calls.length, 0);
    const res = await c.patch(`/adoption/${a.id}`, { location: 'Moema, São Paulo, SP' });
    assert.equal(res.body.adoption.locationLat, null);
    await app.geo.idle();
    assert.deepEqual(geocoder.calls, ['Moema, São Paulo, SP']);
  });

  test('BR-ADOPT-003 marcar como adotado tira da lista e é idempotente', async () => {
    const a = await mkAdoption();
    const c = await as('maria@exemplo.com');
    const first = await c.post(`/adoption/${a.id}/adopted`);
    assert.equal(first.status, 200);
    assert.equal(first.body.adoption.isAdopted, true);
    assert.equal((await c.post(`/adoption/${a.id}/adopted`)).status, 200);
    assert.equal((await anon().get('/adoption')).body.items.length, 0);
    const carlos = await as('carlos@exemplo.com');
    assert.equal((await carlos.post(`/adoption/${a.id}/adopted`)).status, 403);
  });

  test('excluir: dono 204 e some; outra pessoa 403; inexistente 404', async () => {
    const a = await mkAdoption();
    const carlos = await as('carlos@exemplo.com');
    assert.equal((await carlos.del(`/adoption/${a.id}`)).status, 403);
    const maria = await as('maria@exemplo.com');
    assert.equal((await maria.del(`/adoption/${a.id}`)).status, 204);
    assert.equal(await prisma.adoptionPost.count(), 0);
    assert.equal((await maria.del(`/adoption/${a.id}`)).status, 404);
  });
});

describe('fotos da adoção (mesmo código dos posts, tabela adoption_photos)', () => {
  const png = () => sharp({ create: { width: 900, height: 600, channels: 3, background: '#88aacc' } }).png().toBuffer();

  test('BR-PHOTO-002/007 envia, a primeira é principal, remover e excluir apagam os arquivos', async () => {
    const a = await mkAdoption();
    const c = await as('maria@exemplo.com');
    const form = new FormData();
    form.append('photos', new Blob([await png()]), 'a.png');
    form.append('photos', new Blob([await png()]), 'b.png');
    const up = await c.upload(`/adoption/${a.id}/photos`, form);
    assert.equal(up.status, 201);
    assert.deepEqual(up.body.rejected, []);
    assert.deepEqual(up.body.adoption.photos.map((p) => p.isPrimary), [true, false]);
    assert.equal(await prisma.adoptionPhoto.count(), 2);
    assert.equal(await prisma.photo.count(), 0); // não foi para a tabela dos posts
    assert.equal((await readdir(dir)).length, 2);

    const [first] = up.body.adoption.photos;
    const del = await c.del(`/adoption/${a.id}/photos/${first.id}`);
    assert.equal(del.status, 200);
    assert.equal(del.body.adoption.photos[0].isPrimary, true); // a outra virou principal
    assert.equal((await readdir(dir)).length, 1);

    assert.equal((await c.del(`/adoption/${a.id}`)).status, 204);
    assert.deepEqual(await readdir(dir), []);
  });

  test('PERM-001 outra pessoa não envia foto', async () => {
    const a = await mkAdoption();
    const form = new FormData();
    form.append('photos', new Blob([await png()]), 'a.png');
    const carlos = await as('carlos@exemplo.com');
    assert.equal((await carlos.upload(`/adoption/${a.id}/photos`, form)).status, 403);
    assert.deepEqual(await readdir(dir), []);
  });
});

test('GET /me/adoption lista todos os do usuário, inclusive inativos e adotados', async () => {
  await mkAdoption({ title: 'a' });
  await mkAdoption({ title: 'b', isActive: false });
  await mkAdoption({ title: 'c', isAdopted: true });
  await prisma.adoptionPost.create({ data: { ...body({ title: 'do admin' }), userId: admin.id } });
  const res = await (await as('maria@exemplo.com')).get('/me/adoption');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.items.map((i) => i.title), ['c', 'b', 'a']);
  assert.equal((await anon().get('/me/adoption')).status, 401);
  assert.ok(maria.id);
});
