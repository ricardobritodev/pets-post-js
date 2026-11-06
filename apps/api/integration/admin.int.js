// Integração: painel admin contra MySQL real — specs/api/admin.md (BR-ADMIN-*, PERM-003/005, BR-PARTNER-002)
import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@petspost/db';
import { clearDatabase } from '@petspost/db/testing';
import { hashPassword } from '@petspost/domain';
import { startApp, createClient, LOOSE_LIMITS } from './helpers.js';

const geocoder = {
  calls: [],
  async geocode(address) {
    this.calls.push(address);
    return address.includes('Lugar Nenhum') ? null : { lat: -23.55, lng: -46.63 };
  },
};

let app;
let hash;
let admin;
let maria;
let carlos;

before(async () => {
  app = await startApp({ db: prisma, limits: LOOSE_LIMITS, geocoder });
  hash = await hashPassword('Senha@123');
});
after(async () => {
  await app?.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await clearDatabase(prisma);
  geocoder.calls.length = 0;
  const mk = (name, email, role = 'user', createdAt = new Date()) =>
    prisma.user.create({ data: { name, email, role, passwordHash: hash, createdAt } });
  admin = await mk('Admin', 'admin@exemplo.com', 'admin', new Date(Date.UTC(2026, 0, 1)));
  maria = await mk('Maria Silva', 'maria@exemplo.com', 'user', new Date(Date.UTC(2026, 0, 2)));
  carlos = await mk('Carlos Souza', 'carlos@exemplo.com', 'user', new Date(Date.UTC(2026, 0, 3)));
});

const post = (over = {}) => ({
  title: 'Cachorro perdido',
  description: 'x',
  status: 'lost',
  petType: 'dog',
  lastSeenLocation: 'Centro, São Paulo, SP',
  contactPhone: '(11) 98765-4321',
  userId: maria.id,
  ...over,
});
const adoption = (over = {}) => ({
  title: 'Gato para adoção',
  description: 'x',
  petType: 'cat',
  location: 'Moema, São Paulo, SP',
  contactPhone: '(11) 98765-4321',
  userId: maria.id,
  ...over,
});
const partner = (over = {}) => ({ name: 'Clínica Amigo', partnerType: 'vet_clinic', address: 'Rua X, São Paulo, SP', ...over });

const as = (email) => createClient(app.base).loginAs(email);
const asAdmin = () => as('admin@exemplo.com');

test('PERM-003 todas as rotas admin: visitante 401, usuário comum 403', async () => {
  const routes = [
    ['GET', '/admin/stats'], ['GET', '/admin/users'], ['POST', `/admin/users/${maria.id}/toggle`],
    ['GET', '/admin/posts'], ['PATCH', '/admin/posts/1'], ['GET', '/admin/adoption'], ['PATCH', '/admin/adoption/1'],
    ['GET', '/admin/partners'], ['GET', '/admin/partners/1'], ['POST', '/admin/partners'],
    ['PATCH', '/admin/partners/1'], ['DELETE', '/admin/partners/1'],
  ];
  const anon = await createClient(app.base).init();
  const user = await as('maria@exemplo.com');
  for (const [method, path] of routes) {
    const json = method === 'GET' || method === 'DELETE' ? undefined : { isActive: false };
    assert.equal((await anon.request(method, path, { json })).status, 401, `${method} ${path} visitante`);
    const res = await user.request(method, path, { json });
    assert.equal(res.status, 403, `${method} ${path} usuário`);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  }
  assert.equal((await prisma.user.findUnique({ where: { id: maria.id } })).isActive, true);
});

test('BR-ADMIN-001/004 estatísticas e recentes', async () => {
  await prisma.petPost.createMany({
    data: [
      post({ title: 'a' }), post({ title: 'b', status: 'found' }), post({ title: 'c', isResolved: true }),
      post({ title: 'd', isActive: false }),
    ],
  });
  await prisma.adoptionPost.createMany({ data: [adoption(), adoption({ isAdopted: true }), adoption({ isActive: false })] });
  await prisma.partner.createMany({ data: [partner({ lat: -23, lng: -46 }), partner({ name: 'Sem mapa' }), partner({ name: 'Inativo', isActive: false, lat: 1, lng: 1 })] });
  await prisma.user.update({ where: { id: carlos.id }, data: { isActive: false } });

  const res = await (await asAdmin()).get('/admin/stats');
  assert.equal(res.status, 200);
  const { recent, ...counts } = res.body;
  assert.deepEqual(counts, {
    users: { total: 3, active: 2 },
    posts: { total: 4, active: 2, resolved: 1, lost: 1, found: 1, hidden: 1 },
    adoption: { total: 3, available: 1, adopted: 1, hidden: 1 },
    partners: { total: 3, active: 2, withoutCoords: 1 },
  });
  assert.equal(recent.posts.length, 4);
  assert.equal(recent.adoptions.length, 3);
  assert.deepEqual(recent.users.map((u) => u.name), ['Carlos Souza', 'Maria Silva', 'Admin']);
  assert.deepEqual(recent.posts[0].owner, { id: maria.id, name: 'Maria Silva', email: 'maria@exemplo.com' });
  assert.ok(!JSON.stringify(res.body).includes('passwordHash'));
});

describe('usuários', () => {
  test('lista com busca por nome ou email e contagem de anúncios', async () => {
    await prisma.petPost.create({ data: post() });
    await prisma.adoptionPost.create({ data: adoption() });
    const c = await asAdmin();
    const all = await c.get('/admin/users');
    assert.equal(all.body.total, 3);
    assert.equal(all.body.pageSize, 20);
    const found = await c.get('/admin/users?q=MARIA');
    assert.deepEqual(found.body.items.map((u) => [u.email, u.postCount, u.adoptionCount]), [['maria@exemplo.com', 1, 1]]);
    assert.equal((await c.get('/admin/users?q=souza')).body.items[0].name, 'Carlos Souza');
  });

  test('BR-ADMIN-002/005 desativar encerra as sessões da pessoa na hora; reativar volta a deixar entrar', async () => {
    const mariaClient = await as('maria@exemplo.com');
    assert.equal((await mariaClient.get('/auth/me')).status, 200);
    assert.ok((await prisma.session.count({ where: { userId: maria.id } })) >= 1);

    const c = await asAdmin();
    const off = await c.post(`/admin/users/${maria.id}/toggle`);
    assert.equal(off.status, 200);
    assert.equal(off.body.user.isActive, false);
    assert.equal(await prisma.session.count({ where: { userId: maria.id } }), 0);
    assert.equal((await mariaClient.get('/auth/me')).status, 401); // caiu na hora
    assert.ok(app.events.some((e) => e.event === 'admin_user_toggled' && e.userId === maria.id && e.isActive === false));

    const login = await createClient(app.base).init();
    assert.equal((await login.post('/auth/login', { email: 'maria@exemplo.com', password: 'Senha@123' })).status, 403);

    const on = await c.post(`/admin/users/${maria.id}/toggle`);
    assert.equal(on.body.user.isActive, true);
    assert.equal((await as('maria@exemplo.com').then((m) => m.get('/auth/me'))).status, 200);
  });

  test('PERM-005 admin não desativa a si mesmo; inexistente → 404', async () => {
    const c = await asAdmin();
    const self = await c.post(`/admin/users/${admin.id}/toggle`);
    assert.equal(self.status, 400);
    assert.equal(self.body.error.message, 'Você não pode desativar sua própria conta.');
    assert.equal((await prisma.user.findUnique({ where: { id: admin.id } })).isActive, true);
    assert.equal((await c.post('/admin/users/999999/toggle')).status, 404);
  });
});

describe('moderação', () => {
  test('BR-ADMIN-003 lista tudo (inclusive ocultos), filtra e oculta/reexibe', async () => {
    const visible = await prisma.petPost.create({ data: post({ title: 'Rex perdido' }) });
    await prisma.petPost.create({ data: post({ title: 'Oculto', isActive: false }) });
    await prisma.petPost.create({ data: post({ title: 'Achei gato', status: 'found' }) });
    const c = await asAdmin();

    assert.equal((await c.get('/admin/posts')).body.total, 3);
    assert.deepEqual((await c.get('/admin/posts?visibility=hidden')).body.items.map((p) => p.title), ['Oculto']);
    assert.deepEqual((await c.get('/admin/posts?status=found')).body.items.map((p) => p.title), ['Achei gato']);
    assert.deepEqual((await c.get('/admin/posts?q=rex')).body.items.map((p) => p.title), ['Rex perdido']);

    const hide = await c.patch(`/admin/posts/${visible.id}`, { isActive: false });
    assert.equal(hide.status, 200);
    assert.equal(hide.body.item.isActive, false);
    // sumiu do site e o link dá 404 para os outros (PERM-002); a dona ainda vê
    const anon = createClient(app.base);
    assert.equal((await anon.get(`/posts/${visible.id}`)).status, 404);
    assert.ok(!(await anon.get('/posts')).body.items.some((p) => p.id === visible.id));
    assert.equal((await (await as('maria@exemplo.com')).get(`/posts/${visible.id}`)).status, 200);

    assert.equal((await c.patch(`/admin/posts/${visible.id}`, { isActive: true })).body.item.isActive, true);
    assert.equal((await anon.get(`/posts/${visible.id}`)).status, 200);
    assert.equal((await c.patch(`/admin/posts/${visible.id}`, { isActive: 'false' })).status, 400);
    assert.equal((await c.patch('/admin/posts/999999', { isActive: false })).status, 404);
  });

  test('BR-ADMIN-004 moderação de adoção', async () => {
    const a = await prisma.adoptionPost.create({ data: adoption() });
    const c = await asAdmin();
    assert.equal((await c.get('/admin/adoption')).body.items[0].owner.email, 'maria@exemplo.com');
    assert.equal((await c.patch(`/admin/adoption/${a.id}`, { isActive: false })).body.item.isActive, false);
    assert.equal((await createClient(app.base).get(`/adoption/${a.id}`)).status, 404);
  });
});

describe('parceiros (BR-PARTNER-002)', () => {
  test('criar geocodifica na hora; endereço não achado salva mas avisa (geocoded false)', async () => {
    const c = await asAdmin();
    const ok = await c.post('/admin/partners', { name: 'Clínica Sé', type: 'vet_clinic', address: 'Praça da Sé, São Paulo, SP' });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.geocoded, true);
    assert.equal(ok.body.partner.lat, -23.55);
    assert.equal(ok.body.partner.isActive, true);
    assert.equal(ok.body.partner.typeLabel, 'Clínica Veterinária');

    const miss = await c.post('/admin/partners', { name: 'Perdido', type: 'petshop', address: 'Lugar Nenhum' });
    assert.equal(miss.status, 201);
    assert.equal(miss.body.geocoded, false);
    assert.equal(miss.body.partner.lat, null);
    // sem coordenadas não aparece no mapa público (BR-PARTNER-001)
    const map = await createClient(app.base).get('/partners');
    assert.deepEqual(map.body.items.map((p) => p.name), ['Clínica Sé']);
  });

  test('coordenadas manuais não chamam o geocoder; editar sem mudar endereço também não', async () => {
    const c = await asAdmin();
    const res = await c.post('/admin/partners', { name: 'Lar', type: 'foster_home', address: 'Rua Y', lat: '-23.6', lng: '-46.7' });
    assert.equal(res.body.geocoded, null);
    assert.equal(res.body.partner.lat, -23.6);
    const id = res.body.partner.id;
    const edit = await c.patch(`/admin/partners/${id}`, { phone: '(11) 3333-4444', isActive: false });
    assert.equal(edit.body.geocoded, null);
    assert.equal(edit.body.partner.isActive, false);
    assert.equal(edit.body.partner.phone, '(11) 3333-4444');
    assert.deepEqual(geocoder.calls, []);
  });

  test('BR-GEO-002 endereço novo geocodifica de novo; não achando, apaga as coordenadas antigas', async () => {
    const p = await prisma.partner.create({ data: partner({ lat: -1, lng: -2 }) });
    const c = await asAdmin();
    const moved = await c.patch(`/admin/partners/${p.id}`, { address: 'Avenida Paulista, São Paulo, SP' });
    assert.equal(moved.body.geocoded, true);
    assert.equal(moved.body.partner.lat, -23.55);
    const lost = await c.patch(`/admin/partners/${p.id}`, { address: 'Lugar Nenhum' });
    assert.equal(lost.body.geocoded, false);
    assert.equal(lost.body.partner.lat, null);
  });

  test('site só http/https, campos obrigatórios, lista com inativos, detalhe e exclusão', async () => {
    const c = await asAdmin();
    const bad = await c.post('/admin/partners', { name: 'X', type: 'petshop', address: 'Rua Z', website: 'javascript:alert(1)' });
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.body.error.details.map((d) => d.path), ['website']);
    const empty = await c.post('/admin/partners', {});
    assert.deepEqual(empty.body.error.details.map((d) => d.path).sort(), ['address', 'name', 'type']);

    const off = await prisma.partner.create({ data: partner({ name: 'Inativo', isActive: false }) });
    const list = await c.get('/admin/partners?q=inat');
    assert.deepEqual(list.body.items.map((p) => p.name), ['Inativo']);
    assert.equal((await c.get(`/admin/partners/${off.id}`)).body.partner.name, 'Inativo');
    assert.equal((await c.del(`/admin/partners/${off.id}`)).status, 204);
    assert.equal((await c.get(`/admin/partners/${off.id}`)).status, 404);
    assert.equal((await c.del(`/admin/partners/${off.id}`)).status, 404);
  });
});
