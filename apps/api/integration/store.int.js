// Integração: loja (vitrine + admin) contra MySQL real — specs/api/store.md (BR-STORE-001..008)
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

let app;
let dir;
let hash;
let shop; // parceiro ativo com site
let zap; // parceiro ativo só com telefone
let closed; // parceiro inativo

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'petspost-store-'));
  app = await startApp({ db: prisma, limits: LOOSE_LIMITS, storage: createDiskStorage({ dir }) });
  hash = await hashPassword('Senha@123');
});
after(async () => {
  await app?.close();
  await prisma.$disconnect();
  if (dir) await rm(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  await clearDatabase(prisma);
  for (const f of await readdir(dir)) await rm(join(dir, f));
  await prisma.user.createMany({
    data: [
      { name: 'Admin', email: 'admin@exemplo.com', role: 'admin', passwordHash: hash },
      { name: 'Maria', email: 'maria@exemplo.com', passwordHash: hash },
    ],
  });
  const p = (data) => prisma.partner.create({ data: { address: 'Rua X, São Paulo, SP', partnerType: 'petshop', ...data } });
  shop = await p({ name: 'Petshop Bom Pet', website: 'https://bompet.com.br', phone: '(11) 98888-7777' });
  zap = await p({ name: 'Pet do Bairro', phone: '(11) 97777-6666' });
  closed = await p({ name: 'Fechado', isActive: false });
});

let seq = 0;
const mkProduct = (over = {}) =>
  prisma.product.create({
    data: {
      name: 'Ração Premium 10 kg', category: 'food', priceCents: 18990, stock: 5, partnerId: shop.id,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, seq++)), ...over,
    },
  });
const anon = () => createClient(app.base);
const asAdmin = () => createClient(app.base).loginAs('admin@exemplo.com');
const names = (res) => res.body.items.map((p) => p.name);

describe('vitrine pública', () => {
  test('BR-STORE-001 só ativos de parceiros ativos; destaques primeiro', async () => {
    await mkProduct({ name: 'Antigo' });
    await mkProduct({ name: 'Novo' });
    await mkProduct({ name: 'Destaque', isFeatured: true });
    await mkProduct({ name: 'Inativo', isActive: false });
    await mkProduct({ name: 'De parceiro fechado', partnerId: closed.id });
    const res = await anon().get('/store/products');
    assert.equal(res.status, 200);
    assert.deepEqual(names(res), ['Destaque', 'Novo', 'Antigo']);
    assert.equal(res.body.pageSize, 24);
  });

  test('BR-STORE-003 preço final, desconto e ordenação pelo preço final', async () => {
    await mkProduct({ name: 'Cara com promo', priceCents: 30000, promoPriceCents: 9000 }); // final 90,00
    await mkProduct({ name: 'Média', priceCents: 15000 });
    await mkProduct({ name: 'Barata', priceCents: 5000 });
    const asc = await anon().get('/store/products?sort=price_asc');
    assert.deepEqual(names(asc), ['Barata', 'Cara com promo', 'Média']);
    assert.deepEqual(names(await anon().get('/store/products?sort=price_desc')), ['Média', 'Cara com promo', 'Barata']);
    const promo = asc.body.items[1];
    assert.deepEqual([promo.priceCents, promo.promoPriceCents, promo.finalPriceCents, promo.discountPercent], [30000, 9000, 9000, 70]);
    assert.equal(asc.body.items[0].discountPercent, null);
  });

  test('BR-STORE-002 filtros: categoria, animal (inclui "todos os pets"), parceiro e busca', async () => {
    await mkProduct({ name: 'Ração cão', petType: 'dog' });
    await mkProduct({ name: 'Ração gato', petType: 'cat' });
    await mkProduct({ name: 'Bola', category: 'toys', petType: null });
    await mkProduct({ name: 'Petisco do bairro', category: 'treats', partnerId: zap.id });
    assert.deepEqual(names(await anon().get('/store/products?category=toys')), ['Bola']);
    assert.deepEqual(names(await anon().get('/store/products?petType=dog')).sort(), ['Bola', 'Petisco do bairro', 'Ração cão'].sort());
    assert.deepEqual(names(await anon().get(`/store/products?partnerId=${zap.id}`)), ['Petisco do bairro']);
    assert.deepEqual(names(await anon().get('/store/products?q=RAÇÃO')).sort(), ['Ração cão', 'Ração gato']);
    assert.equal((await anon().get('/store/products?category=xyz&sort=barato')).body.total, 4); // inválido é ignorado
  });

  test('BR-STORE-004 esgotado continua aparecendo, com inStock false', async () => {
    await mkProduct({ name: 'Esgotado', stock: 0 });
    const [item] = (await anon().get('/store/products')).body.items;
    assert.equal(item.inStock, false);
  });

  test('BR-STORE-005 link de compra: produto → site → WhatsApp', async () => {
    const withUrl = await mkProduct({ url: 'https://bompet.com.br/racao-10kg' });
    const viaSite = await mkProduct();
    const viaZap = await mkProduct({ name: 'Petisco', partnerId: zap.id });
    const get = async (p) => (await anon().get(`/store/products/${p.id}`)).body.product;
    assert.deepEqual([(await get(withUrl)).buyChannel, (await get(withUrl)).buyUrl], ['product', 'https://bompet.com.br/racao-10kg']);
    assert.deepEqual([(await get(viaSite)).buyChannel, (await get(viaSite)).buyUrl], ['site', 'https://bompet.com.br/']);
    const z = await get(viaZap);
    assert.equal(z.buyChannel, 'whatsapp');
    assert.match(decodeURIComponent(z.buyUrl), /\*Petisco\* no Pets Post/);
    assert.equal(z.partner.name, 'Pet do Bairro');
    assert.equal(z.stock, 5);
  });

  test('BR-STORE-001 detalhe de produto inativo ou de parceiro inativo → 404', async () => {
    const off = await mkProduct({ isActive: false });
    const ofClosed = await mkProduct({ partnerId: closed.id });
    for (const p of [off, ofClosed]) assert.equal((await anon().get(`/store/products/${p.id}`)).status, 404);
    assert.equal((await anon().get('/store/products/abc')).status, 404);
  });

  test('categorias com a contagem do que está visível', async () => {
    await mkProduct({ category: 'toys' });
    await mkProduct({ category: 'toys' });
    await mkProduct({ category: 'toys', isActive: false });
    const res = await anon().get('/store/categories');
    assert.equal(res.body.items.length, 7);
    assert.deepEqual(res.body.items.find((c) => c.value === 'toys'), { value: 'toys', label: 'Brinquedos', count: 2 });
    assert.equal(res.body.items.find((c) => c.value === 'food').count, 0);
  });
});

describe('admin (BR-STORE-006)', () => {
  test('PERM-003 rotas de produtos: visitante 401, usuário comum 403', async () => {
    const p = await mkProduct();
    const anonC = await createClient(app.base).init();
    const user = await createClient(app.base).loginAs('maria@exemplo.com');
    for (const [method, path] of [['GET', '/admin/products'], ['POST', '/admin/products'], ['PATCH', `/admin/products/${p.id}`], ['DELETE', `/admin/products/${p.id}`], ['POST', `/admin/products/${p.id}/photos`]]) {
      const json = method === 'GET' || method === 'DELETE' ? undefined : { name: 'x' };
      assert.equal((await anonC.request(method, path, { json })).status, 401, `${method} ${path}`);
      assert.equal((await user.request(method, path, { json })).status, 403, `${method} ${path}`);
    }
    assert.equal(await prisma.product.count(), 1);
  });

  test('criar, editar e excluir; parceiro precisa existir; promoção menor que o preço', async () => {
    const c = await asAdmin();
    const created = await c.post('/admin/products', { partnerId: shop.id, name: 'Arranhador', category: 'toys', petType: 'cat', priceCents: 12990, stock: 3 });
    assert.equal(created.status, 201);
    const { product } = created.body;
    assert.deepEqual([product.categoryLabel, product.petTypeLabel, product.isActive, product.isFeatured], ['Brinquedos', 'Gato', true, false]);

    const noPartner = await c.post('/admin/products', { partnerId: 999999, name: 'X', category: 'toys', priceCents: 100 });
    assert.equal(noPartner.status, 400);
    assert.deepEqual(noPartner.body.error.details.map((d) => d.path), ['partnerId']);

    const promo = await c.patch(`/admin/products/${product.id}`, { promoPriceCents: 9990, isFeatured: true });
    assert.equal(promo.body.product.discountPercent, 23);
    // preço novo abaixo da promoção que já existe → erro
    const lower = await c.patch(`/admin/products/${product.id}`, { priceCents: 5000 });
    assert.equal(lower.status, 400);
    assert.deepEqual(lower.body.error.details.map((d) => d.path), ['promoPriceCents']);

    const list = await c.get('/admin/products?q=arranha');
    assert.equal(list.body.items[0].partnerId, shop.id);
    assert.equal((await c.del(`/admin/products/${product.id}`)).status, 204);
    assert.equal((await c.get(`/admin/products/${product.id}`)).status, 404);
  });

  test('BR-STORE-007 fotos: até 6, a primeira é principal, excluir apaga os arquivos', async () => {
    const p = await mkProduct();
    const c = await asAdmin();
    const png = await sharp({ create: { width: 600, height: 600, channels: 3, background: '#ffaa00' } }).png().toBuffer();
    const form = new FormData();
    for (let i = 0; i < 7; i++) form.append('photos', new Blob([png]), `f${i}.png`);
    const up = await c.upload(`/admin/products/${p.id}/photos`, form);
    assert.equal(up.status, 201);
    assert.equal(up.body.product.photos.length, 6);
    assert.equal(up.body.rejected.length, 1);
    assert.equal(up.body.product.photos[0].isPrimary, true);
    assert.equal(await prisma.productPhoto.count(), 6);
    assert.equal((await readdir(dir)).length, 6);
    const pub = await anon().get(`/store/products/${p.id}`);
    assert.equal(pub.body.product.primaryPhoto.url, up.body.product.photos[0].url);
    assert.equal((await c.del(`/admin/products/${p.id}`)).status, 204);
    assert.deepEqual(await readdir(dir), []);
  });

  test('BR-STORE-008 parceiro com produtos não pode ser excluído (409)', async () => {
    await mkProduct();
    const c = await asAdmin();
    const res = await c.del(`/admin/partners/${shop.id}`);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CONFLICT');
    assert.match(res.body.error.message, /1 produto/);
    assert.equal((await c.del(`/admin/partners/${zap.id}`)).status, 204); // sem produtos, pode
  });
});
