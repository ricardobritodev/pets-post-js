// Integração: importar produto de um link — specs/api/store.md (BR-STORE-009..011)
// Importador real (leitor + miniaturas + fotos); só a "internet" é falsa (páginas e fotos em memória).
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { prisma } from '@petspost/db';
import { clearDatabase } from '@petspost/db/testing';
import { hashPassword } from '@petspost/domain';
import { createDiskStorage } from '../src/lib/storage.js';
import { parseSafeUrl } from '../src/lib/safe-fetch.js';
import { createProductImporter } from '../src/modules/store/importer.js';
import { startApp, createClient, LOOSE_LIMITS } from './helpers.js';

const pages = new Map();
const html = (body) => ({ status: 200, contentType: 'text/html; charset=utf-8', body: Buffer.from(body) });
const fakeFetcher = {
  calls: [],
  async fetchUrl(raw) {
    const url = parseSafeUrl(raw).toString(); // mesma validação de link da busca real
    this.calls.push(url);
    const page = pages.get(url) ?? { status: 404, contentType: 'text/html', body: Buffer.from('não achei') };
    return { url, ...page };
  },
};
const productPage = (price, availability = 'InStock') => html(`<html><head>
  <link rel="canonical" href="https://loja.exemplo.com.br/p/racao-umida" />
  <script type="application/ld+json">{"@type":"Product","name":"Ração Úmida para Cães Adultos Sachê Carne 85g",
  "description":"Alimento completo e balanceado.","image":["https://cdn.exemplo.com.br/1.jpg","https://cdn.exemplo.com.br/quebrada.jpg"],
  "offers":{"@type":"Offer","price":"${price}","availability":"https://schema.org/${availability}"}}</script></head></html>`);

let app;
let dir;
let partner;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'petspost-import-'));
  const png = await sharp({ create: { width: 900, height: 700, channels: 3, background: '#ff8800' } }).png().toBuffer();
  pages.set('https://cdn.exemplo.com.br/1.jpg', { status: 200, contentType: 'image/png', body: png });
  pages.set('https://cdn.exemplo.com.br/quebrada.jpg', { status: 200, contentType: 'text/html', body: Buffer.from('<html>') });
  pages.set('https://bloqueado.com.br/p/1', { status: 403, contentType: 'text/html', body: Buffer.from('Access Denied') });
  pages.set('https://semproduto.com.br/', html('<html><body>Bem-vindo</body></html>'));
  app = await startApp({
    db: prisma, limits: LOOSE_LIMITS, storage: createDiskStorage({ dir }),
    importer: createProductImporter({ fetcher: fakeFetcher }),
  });
});
after(async () => {
  await app?.close();
  await prisma.$disconnect();
  if (dir) await rm(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  await clearDatabase(prisma);
  for (const f of await readdir(dir)) await rm(join(dir, f));
  fakeFetcher.calls.length = 0;
  pages.set('https://loja.exemplo.com.br/p/racao-umida', productPage('3.49'));
  pages.set('https://loja.exemplo.com.br/p/racao-umida?utm_source=x', productPage('3.49')); // link com rastreio: mesma página
  const hash = await hashPassword('Senha@123');
  await prisma.user.createMany({
    data: [
      { name: 'Admin', email: 'admin@exemplo.com', role: 'admin', passwordHash: hash },
      { name: 'Maria', email: 'maria@exemplo.com', passwordHash: hash },
    ],
  });
  partner = await prisma.partner.create({ data: { name: 'Loja Exemplo', partnerType: 'petshop', address: 'Rua X' } });
});

const asAdmin = () => createClient(app.base).loginAs('admin@exemplo.com');

test('BR-STORE-009 importar: rascunho com nome, preço, link, sugestões e miniatura (nada salvo)', async () => {
  const c = await asAdmin();
  const res = await c.post('/admin/products/import', { url: 'https://loja.exemplo.com.br/p/racao-umida?utm_source=x' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.draft, {
    name: 'Ração Úmida para Cães Adultos Sachê Carne 85g',
    description: 'Alimento completo e balanceado.',
    priceCents: 349,
    inStock: true,
    url: 'https://loja.exemplo.com.br/p/racao-umida',
    category: 'food',
    petType: 'dog',
    siteName: 'loja.exemplo.com.br',
  });
  // a foto quebrada (não é imagem) fica de fora; a boa vem com miniatura data:
  assert.equal(res.body.images.length, 1);
  assert.equal(res.body.images[0].url, 'https://cdn.exemplo.com.br/1.jpg');
  assert.match(res.body.images[0].thumb, /^data:image\/jpeg;base64,/);
  assert.deepEqual(res.body.warnings, []);
  assert.equal(await prisma.product.count(), 0);
});

test('BR-STORE-009 site que bloqueia, página sem produto e link inválido → mensagens claras', async () => {
  const c = await asAdmin();
  const blocked = await c.post('/admin/products/import', { url: 'https://bloqueado.com.br/p/1' });
  assert.equal(blocked.status, 422);
  assert.equal(blocked.body.error.code, 'IMPORT_FAILED');
  assert.match(blocked.body.error.message, /bloqueado\.com\.br não permite leitura automática \(respondeu 403\)/);

  const empty = await c.post('/admin/products/import', { url: 'https://semproduto.com.br/' });
  assert.equal(empty.status, 422);
  assert.match(empty.body.error.message, /Não encontrei os dados do produto/);

  for (const url of ['http://loja.exemplo.com.br/p', 'https://127.0.0.1/admin', 'nao-e-link']) {
    const r = await c.post('/admin/products/import', { url });
    assert.equal(r.status, url === 'https://127.0.0.1/admin' ? 422 : 400, url);
  }
  assert.equal((await c.post('/admin/products/import', {})).status, 400);
});

test('BR-STORE-010 só o admin importa (visitante 401, usuário comum 403)', async () => {
  const anon = await createClient(app.base).init();
  assert.equal((await anon.post('/admin/products/import', { url: 'https://loja.exemplo.com.br/p/racao-umida' })).status, 401);
  const user = await createClient(app.base).loginAs('maria@exemplo.com');
  assert.equal((await user.post('/admin/products/import', { url: 'https://loja.exemplo.com.br/p/racao-umida' })).status, 403);
  assert.deepEqual(fakeFetcher.calls, []); // ninguém sem permissão faz o servidor acessar sites
});

test('BR-STORE-009/011 salvar o rascunho e baixar as fotos escolhidas; priceCheckedAt preenchido', async () => {
  const c = await asAdmin();
  const { body: imported } = await c.post('/admin/products/import', { url: 'https://loja.exemplo.com.br/p/racao-umida' });
  const created = await c.post('/admin/products', { ...imported.draft, partnerId: partner.id, category: 'food', inStock: undefined, siteName: undefined });
  assert.equal(created.status, 201);
  const { product } = created.body;
  assert.ok(product.priceCheckedAt);
  assert.equal(product.buyChannel, 'product');

  const photos = await c.post(`/admin/products/${product.id}/photos/import`, { urls: ['https://cdn.exemplo.com.br/1.jpg', 'https://cdn.exemplo.com.br/quebrada.jpg'] });
  assert.equal(photos.status, 201);
  assert.equal(photos.body.product.photos.length, 1);
  assert.equal(photos.body.rejected.length, 1);
  assert.match(photos.body.rejected[0].message, /Não consegui baixar/);
  assert.equal((await readdir(dir)).length, 1); // re-codificada e salva como as outras fotos
  const meta = await sharp(join(dir, (await readdir(dir))[0])).metadata();
  assert.equal(meta.format, 'jpeg');
  assert.equal(meta.width, 800);
});

test('BR-STORE-011 "Atualizar do link": preço e estoque novos, promoção que ficaria maior é apagada', async () => {
  const p = await prisma.product.create({
    data: { partnerId: partner.id, name: 'Ração', category: 'food', priceCents: 500, promoPriceCents: 400, stock: 3,
      url: 'https://loja.exemplo.com.br/p/racao-umida', priceCheckedAt: new Date(Date.UTC(2026, 0, 1)) },
  });
  const c = await asAdmin();
  pages.set('https://loja.exemplo.com.br/p/racao-umida', productPage('3.49', 'OutOfStock'));
  const res = await c.post(`/admin/products/${p.id}/refresh`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.changed, { priceCents: [500, 349], inStock: [true, false] });
  assert.equal(res.body.product.priceCents, 349);
  assert.equal(res.body.product.promoPriceCents, null); // 4,00 não é menor que 3,49
  assert.equal(res.body.product.stock, 0);
  assert.ok(new Date(res.body.product.priceCheckedAt) > new Date(Date.UTC(2026, 0, 2)));

  // site fora do ar: o produto não muda
  pages.set('https://loja.exemplo.com.br/p/racao-umida', { status: 403, contentType: 'text/html', body: Buffer.from('x') });
  assert.equal((await c.post(`/admin/products/${p.id}/refresh`)).status, 422);
  assert.equal((await prisma.product.findUnique({ where: { id: p.id } })).priceCents, 349);

  const noUrl = await prisma.product.create({ data: { partnerId: partner.id, name: 'Sem link', category: 'toys', priceCents: 100 } });
  assert.equal((await c.post(`/admin/products/${noUrl.id}/refresh`)).status, 400);
});

test('BR-STORE-011 vitrine mostra a data da consulta; mudar o preço no admin atualiza a data', async () => {
  const c = await asAdmin();
  const { body } = await c.post('/admin/products', { partnerId: partner.id, name: 'Bola', category: 'toys', priceCents: 1000 });
  const first = body.product.priceCheckedAt;
  await prisma.product.update({ where: { id: body.product.id }, data: { priceCheckedAt: new Date(Date.UTC(2026, 0, 1)) } });
  const pub = await createClient(app.base).get(`/store/products/${body.product.id}`);
  assert.equal(pub.body.product.priceCheckedAt, '2026-01-01T00:00:00.000Z');
  await c.patch(`/admin/products/${body.product.id}`, { name: 'Bola nova' });
  assert.equal((await prisma.product.findUnique({ where: { id: body.product.id } })).priceCheckedAt.toISOString(), '2026-01-01T00:00:00.000Z');
  await c.patch(`/admin/products/${body.product.id}`, { priceCents: 900 });
  assert.ok((await prisma.product.findUnique({ where: { id: body.product.id } })).priceCheckedAt > new Date(Date.UTC(2026, 0, 2)));
  assert.ok(first);
});
