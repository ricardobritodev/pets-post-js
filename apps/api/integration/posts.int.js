// Integração: /api/v1/posts e /api/v1/me/posts contra MySQL real — specs/api/posts.md
// Inclui a porta dos casos de pets-post/tests/test_posts.py.
import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@petspost/db';
import { clearDatabase } from '@petspost/db/testing';
import { hashPassword } from '@petspost/domain';
import { startApp, createClient, LOOSE_LIMITS } from './helpers.js';

let app;
let hash;
let maria; // dona dos posts
let carlos; // outro usuário
let admin;

before(async () => {
  app = await startApp({ db: prisma, limits: LOOSE_LIMITS });
  hash = await hashPassword('Senha@123');
});
after(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await clearDatabase(prisma);
  const mk = (name, email, role = 'user') => prisma.user.create({ data: { name, email, role, passwordHash: hash } });
  [maria, carlos, admin] = await Promise.all([
    mk('Maria Silva', 'maria@exemplo.com'),
    mk('Carlos', 'carlos@exemplo.com'),
    mk('Admin', 'admin@exemplo.com', 'admin'),
  ]);
});

const base = {
  title: 'Cachorro caramelo perdido',
  description: 'Fugiu no parque.',
  status: 'lost',
  petType: 'dog',
  lastSeenLocation: 'Parque Ibirapuera, São Paulo, SP',
  contactPhone: '(11) 98765-4321',
};
let seq = 0;
/** Cria um post direto no banco (createdAt crescente para ordenar). */
const mkPost = (over = {}) =>
  prisma.petPost.create({
    data: { ...base, userId: maria.id, createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, seq++)), ...over },
  });
const anon = () => createClient(app.base);
const as = (email) => createClient(app.base).loginAs(email);

describe('GET /posts (listagem pública)', () => {
  test('lista carrega (test_list_posts_loads) no formato paginado', async () => {
    const res = await anon().get('/posts');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { items: [], page: 1, pageSize: 12, total: 0, totalPages: 1 });
  });

  test('BR-POST-002 só ativos e não resolvidos, mais novos primeiro', async () => {
    const a = await mkPost({ title: 'antigo' });
    const b = await mkPost({ title: 'novo' });
    await mkPost({ title: 'inativo', isActive: false });
    await mkPost({ title: 'resolvido', isResolved: true });
    const { body } = await anon().get('/posts');
    assert.deepEqual(body.items.map((p) => p.id), [b.id, a.id]);
  });

  test('BR-POST-003 paginação de 12 e página além do fim vem vazia', async () => {
    for (let i = 0; i < 14; i++) await mkPost({ title: `p${i}` });
    const p1 = (await anon().get('/posts')).body;
    const p2 = (await anon().get('/posts?page=2')).body;
    assert.deepEqual([p1.items.length, p1.total, p1.totalPages], [12, 14, 2]);
    assert.equal(p2.items.length, 2);
    assert.equal(p2.items.at(-1).title, 'p0');
    assert.equal((await anon().get('/posts?page=9')).body.items.length, 0);
  });

  test('BR-POST-003 filtros status e petType; inválidos ignorados; pet_type dos links antigos', async () => {
    await mkPost({ status: 'lost', petType: 'dog' });
    await mkPost({ status: 'found', petType: 'cat' });
    await mkPost({ status: 'found', petType: 'dog' });
    const count = async (qs) => (await anon().get(`/posts${qs}`)).body.total;
    assert.equal(await count('?status=found'), 2);
    assert.equal(await count('?petType=dog'), 2);
    assert.equal(await count('?status=found&petType=cat'), 1);
    assert.equal(await count('?pet_type=cat'), 1);
    assert.equal(await count('?status=xyz&petType=peixe&page=abc'), 3);
  });

  test('card traz rótulos em português e a foto principal (BR-PHOTO-002)', async () => {
    const p = await mkPost();
    await prisma.photo.createMany({
      data: [
        { postId: p.id, filename: 'a.jpg', url: '/uploads/a.jpg' },
        { postId: p.id, filename: 'b.jpg', url: '/uploads/b.jpg', isPrimary: true },
      ],
    });
    const [card] = (await anon().get('/posts')).body.items;
    assert.equal(card.statusLabel, 'Perdido');
    assert.equal(card.petTypeLabel, 'Cachorro');
    assert.deepEqual(card.primaryPhoto, { url: '/uploads/b.jpg' });
    assert.equal('contactPhone' in card, false);
  });
});

test('BR-POST-004 /posts/recent devolve os 12 mais recentes elegíveis (test_home_page_loads)', async () => {
  for (let i = 0; i < 13; i++) await mkPost({ title: `p${i}` });
  await mkPost({ title: 'resolvido', isResolved: true });
  const { status, body } = await anon().get('/posts/recent');
  assert.equal(status, 200);
  assert.equal(body.items.length, 12);
  assert.equal(body.items[0].title, 'p12');
  assert.ok(!body.items.some((p) => p.title === 'resolvido'));
});

describe('GET /posts/:id (detalhe)', () => {
  test('detalhe carrega (test_post_detail_loads) com WhatsApp e sem email do dono', async () => {
    const p = await mkPost({ petName: 'Rex' });
    const { status, body } = await anon().get(`/posts/${p.id}`);
    assert.equal(status, 200);
    assert.equal(body.post.title, base.title);
    assert.deepEqual(body.post.owner, { id: maria.id, name: 'Maria Silva' });
    assert.match(body.post.whatsappUrl, /^https:\/\/wa\.me\/5511987654321\?text=.*Rex/);
    assert.equal(body.post.canManage, false);
    assert.doesNotMatch(JSON.stringify(body), /maria@exemplo\.com/);
  });

  test('post inexistente ou id inválido → 404 (test_post_detail_404)', async () => {
    for (const id of ['99999', 'abc', '0', '-1']) {
      const res = await anon().get(`/posts/${id}`);
      assert.equal(res.status, 404, id);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    }
  });

  test('BR-POST-005 post resolvido continua acessível pelo link', async () => {
    const p = await mkPost({ isResolved: true });
    const res = await anon().get(`/posts/${p.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.post.isResolved, true);
  });

  test('PERM-002 inativo: 404 para visitante e outro usuário; visível para dono e admin', async () => {
    const p = await mkPost({ isActive: false });
    assert.equal((await anon().get(`/posts/${p.id}`)).status, 404);
    assert.equal((await (await as('carlos@exemplo.com')).get(`/posts/${p.id}`)).status, 404);
    const dono = await (await as('maria@exemplo.com')).get(`/posts/${p.id}`);
    assert.deepEqual([dono.status, dono.body.post.canManage], [200, true]);
    assert.equal((await (await as('admin@exemplo.com')).get(`/posts/${p.id}`)).body.post.canManage, true);
  });

  test('BR-CONTACT-001 número que não serve para WhatsApp (0800) → whatsappUrl null', async () => {
    const p = await mkPost({ contactPhone: '(08) 0012-3456' }); // dígitos 0800123456
    assert.equal((await anon().get(`/posts/${p.id}`)).body.post.whatsappUrl, null);
  });
});

describe('POST /posts (criar)', () => {
  test('criar exige login (test_create_post_requires_login)', async () => {
    const c = await anon().init();
    const res = await c.post('/posts', base);
    assert.equal(res.status, 401);
  });

  test('BR-POST-001 cria post do usuário logado, ativo e não resolvido', async () => {
    const c = await as('maria@exemplo.com');
    const res = await c.post('/posts', { ...base, petName: '', reward: 'R$ 100', userId: carlos.id, isActive: false });
    assert.equal(res.status, 201);
    assert.deepEqual(
      [res.body.post.owner.id, res.body.post.isActive, res.body.post.isResolved, res.body.post.petName, res.body.post.reward],
      [maria.id, true, false, null, 'R$ 100'],
    );
    assert.equal(res.body.post.canManage, true);
    assert.equal(await prisma.petPost.count({ where: { userId: maria.id } }), 1);
  });

  test('BR-POST-001 campos obrigatórios faltando → 400 com detalhes por campo', async () => {
    const c = await as('maria@exemplo.com');
    const res = await c.post('/posts', { status: 'lost' });
    assert.equal(res.status, 400);
    const paths = res.body.error.details.map((d) => d.path);
    for (const f of ['title', 'description', 'petType', 'lastSeenLocation', 'contactPhone']) assert.ok(paths.includes(f), f);
  });

  test('BR-AUTH-012 criar sem token CSRF → 403', async () => {
    const c = await as('maria@exemplo.com');
    assert.equal((await c.post('/posts', base, { csrf: false })).status, 403);
  });
});

describe('PATCH / DELETE / resolve (PERM-001)', () => {
  test('PERM-001 dono edita; outro usuário recebe 403 (test_edit_post_requires_owner_or_admin)', async () => {
    const p = await mkPost();
    const outro = await (await as('carlos@exemplo.com')).patch(`/posts/${p.id}`, { title: 'Hackeado' });
    assert.equal(outro.status, 403);
    assert.equal(outro.body.error.code, 'FORBIDDEN');
    const dono = await (await as('maria@exemplo.com')).patch(`/posts/${p.id}`, { title: ' Novo título ', status: 'found' });
    assert.equal(dono.status, 200);
    assert.deepEqual([dono.body.post.title, dono.body.post.status], ['Novo título', 'found']);
    assert.ok(dono.body.post.updatedAt);
  });

  test('PERM-001 admin edita post de qualquer um', async () => {
    const p = await mkPost();
    assert.equal((await (await as('admin@exemplo.com')).patch(`/posts/${p.id}`, { reward: 'R$ 50' })).status, 200);
  });

  test('PATCH sem login → 401; corpo vazio → 400; campo inválido → 400', async () => {
    const p = await mkPost();
    assert.equal((await (await anon().init()).patch(`/posts/${p.id}`, { title: 'x' })).status, 401);
    const c = await as('maria@exemplo.com');
    assert.equal((await c.patch(`/posts/${p.id}`, {})).status, 400);
    assert.equal((await c.patch(`/posts/${p.id}`, { contactPhone: '123' })).status, 400);
  });

  test('PERM-002 escrever em post inativo de outra pessoa → 404 (não revela)', async () => {
    const p = await mkPost({ isActive: false });
    const c = await as('carlos@exemplo.com');
    assert.equal((await c.patch(`/posts/${p.id}`, { title: 'x' })).status, 404);
    assert.equal((await c.del(`/posts/${p.id}`)).status, 404);
    assert.equal((await c.post(`/posts/${p.id}/resolve`)).status, 404);
  });

  test('escrever em post inexistente → 404', async () => {
    const c = await as('maria@exemplo.com');
    assert.equal((await c.patch('/posts/99999', { title: 'x' })).status, 404);
    assert.equal((await c.del('/posts/abc')).status, 404);
  });

  test('BR-POST-006 excluir remove o post e as fotos', async () => {
    const p = await mkPost();
    await prisma.photo.create({ data: { postId: p.id, filename: 'a.jpg', url: '/uploads/a.jpg' } });
    assert.equal((await (await as('carlos@exemplo.com')).del(`/posts/${p.id}`)).status, 403);
    const res = await (await as('maria@exemplo.com')).del(`/posts/${p.id}`);
    assert.equal(res.status, 204);
    assert.equal(await prisma.petPost.count({ where: { id: p.id } }), 0);
    assert.equal(await prisma.photo.count({ where: { postId: p.id } }), 0);
  });

  test('BR-POST-005 resolver tira das listagens, mantém o link e é idempotente', async () => {
    const p = await mkPost();
    const c = await as('maria@exemplo.com');
    assert.equal((await (await as('carlos@exemplo.com')).post(`/posts/${p.id}/resolve`)).status, 403);
    const r1 = await c.post(`/posts/${p.id}/resolve`);
    assert.deepEqual([r1.status, r1.body.post.isResolved], [200, true]);
    assert.equal((await c.post(`/posts/${p.id}/resolve`)).status, 200);
    assert.equal((await anon().get('/posts')).body.total, 0);
    assert.equal((await anon().get(`/posts/${p.id}`)).status, 200);
  });
});

test('/me/posts lista todos os posts do usuário (inclusive inativos e resolvidos) e exige login', async () => {
  await mkPost({ title: 'ativo' });
  await mkPost({ title: 'inativo', isActive: false });
  await mkPost({ title: 'resolvido', isResolved: true });
  await mkPost({ title: 'do carlos', userId: carlos.id });
  assert.equal((await anon().get('/me/posts')).status, 401);
  const { body } = await (await as('maria@exemplo.com')).get('/me/posts');
  assert.deepEqual(body.items.map((p) => p.title), ['resolvido', 'inativo', 'ativo']);
  assert.equal(body.total, 3);
});
