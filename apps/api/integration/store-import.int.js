// Integração: importar produto de um link — specs/api/store.md (BR-STORE-009..013)
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
  partner = await prisma.partner.create({ data: { name: 'Loja Exemplo', partnerType: 'petshop', address: 'Rua X', website: 'https://www.loja.exemplo.com.br' } });
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
    sellerName: null,
    partnerId: partner.id, // BR-STORE-012: o único parceiro com esse site
    newPartner: null,
  });
  assert.deepEqual(res.body.partnerMatches, [{ id: partner.id, name: 'Loja Exemplo', isActive: true }]);
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

/** Página com variações e vendedor, como a da Cobasi (VTEX). */
const groupPage = () => html(`<script type="application/ld+json">{"@type":"ProductGroup","name":"Antipulgas X Cães",
  "url":"https://www.rede.com.br/antipulgas-x/p","hasVariant":[
  {"@type":"Product","name":"Antipulgas X Cães 1 comprimido","sku":"1","url":"https://www.rede.com.br/antipulgas-x/p?idsku=1",
   "offers":{"price":"74.90","availability":"https://schema.org/InStock","seller":{"@type":"Organization","name":"Rede Pet"}}},
  {"@type":"Product","name":"Antipulgas X Cães 3 comprimidos","sku":"3","url":"https://www.rede.com.br/antipulgas-x/p?idsku=3",
   "offers":{"price":"177.90","availability":"https://schema.org/InStock","seller":{"@type":"Organization","name":"Rede Pet"}}}]}</script>`);

test('BR-STORE-012 loja identificada pelo domínio: várias filiais → a do vendedor, com aviso; nenhuma → loja nova', async () => {
  pages.set('https://www.rede.com.br/antipulgas-x/p?idsku=3', groupPage());
  const site = { partnerType: 'petshop', address: 'Rua Y', website: 'https://rede.com.br' };
  const filial = await prisma.partner.create({ data: { ...site, name: 'Rede Pet Santos' } });
  const matriz = await prisma.partner.create({ data: { ...site, name: 'Rede Pet' } });
  await prisma.partner.create({ data: { ...site, name: 'Rede Pet Antiga', isActive: false } });
  const c = await asAdmin();

  const res = await c.post('/admin/products/import', { url: 'https://www.rede.com.br/antipulgas-x/p?idsku=3' });
  assert.equal(res.status, 200);
  assert.equal(res.body.draft.partnerId, matriz.id); // nome igual ao vendedor da página
  assert.equal(res.body.draft.name, 'Antipulgas X Cães 3 comprimidos'); // a variação do link (BR-STORE-009)
  assert.equal(res.body.draft.priceCents, 17790);
  assert.equal(res.body.draft.url, 'https://www.rede.com.br/antipulgas-x/p?idsku=3');
  assert.equal(res.body.partnerMatches.length, 3);
  assert.ok(res.body.warnings.some((w) => w.includes('Rede Pet Santos') && w.includes('Rede Pet Antiga')));

  await prisma.partner.deleteMany({ where: { website: 'https://rede.com.br' } });
  const none = await c.post('/admin/products/import', { url: 'https://www.rede.com.br/antipulgas-x/p?idsku=3' });
  assert.equal(none.body.draft.partnerId, null);
  assert.deepEqual(none.body.partnerMatches, []);
  assert.deepEqual(none.body.draft.newPartner, { name: 'Rede Pet', website: 'https://www.rede.com.br' });
  assert.ok(none.body.warnings.some((w) => /Rede Pet ainda não é parceira/.test(w)));
  assert.ok(filial.id); // (filial criada só para o empate)
});

test('BR-STORE-013 "Vendido e entregue por": vendedor da página, editável; vazio volta para o parceiro', async () => {
  pages.set('https://www.loja.exemplo.com.br/antipulgas-x/p?idsku=1', html(groupPage().body.toString().replaceAll('rede.com.br', 'loja.exemplo.com.br')));
  const c = await asAdmin();
  const { body: imported } = await c.post('/admin/products/import', { url: 'https://www.loja.exemplo.com.br/antipulgas-x/p?idsku=1' });
  assert.equal(imported.draft.sellerName, 'Rede Pet');
  assert.equal(imported.draft.partnerId, partner.id); // subdomínio www do site do parceiro

  const created = await c.post('/admin/products', { ...imported.draft, category: 'health' });
  assert.equal(created.status, 201);
  const { id } = created.body.product;
  assert.equal(created.body.product.sellerName, 'Rede Pet');
  const pub = await createClient(app.base).get(`/store/products/${id}`);
  assert.equal(pub.body.product.soldBy, 'Rede Pet');
  const list = await createClient(app.base).get('/store/products');
  assert.equal(list.body.items[0].soldBy, 'Rede Pet');

  await c.patch(`/admin/products/${id}`, { sellerName: '' });
  assert.equal((await createClient(app.base).get(`/store/products/${id}`)).body.product.soldBy, 'Loja Exemplo');
});

test('BR-STORE-012 parceiro sem site é achado pelo nome; loja nova vira parceiro online ao salvar (sem pino no mapa)', async () => {
  pages.set('https://www.rede.com.br/antipulgas-x/p?idsku=3', groupPage());
  const c = await asAdmin();
  const semSite = await prisma.partner.create({ data: { name: 'Rede Pet Centro', partnerType: 'petshop', address: 'Rua Z' } });
  const byName = await c.post('/admin/products/import', { url: 'https://www.rede.com.br/antipulgas-x/p?idsku=3' });
  assert.equal(byName.body.draft.partnerId, semSite.id);
  assert.equal(byName.body.draft.newPartner, null);
  await prisma.partner.delete({ where: { id: semSite.id } });

  const { body: imported } = await c.post('/admin/products/import', { url: 'https://www.rede.com.br/antipulgas-x/p?idsku=3' });
  const { partnerId, ...draft } = imported.draft;
  const created = await c.post('/admin/products', { ...draft, category: 'health' });
  assert.equal(created.status, 201);
  const loja = await prisma.partner.findUnique({ where: { id: created.body.product.partnerId } });
  assert.deepEqual([loja.name, loja.website, loja.address, loja.lat, loja.partnerType], ['Rede Pet', 'https://www.rede.com.br', 'Loja online', null, 'petshop']);
  // segundo produto da mesma loja usa o parceiro que já existe
  const again = await c.post('/admin/products', { ...draft, category: 'health', name: 'Outro' });
  assert.equal(again.body.product.partnerId, loja.id);
  assert.equal(await prisma.partner.count({ where: { website: 'https://www.rede.com.br' } }), 1);
  // sem parceiro e sem loja nova → erro no campo
  const bad = await c.post('/admin/products', { ...draft, newPartner: undefined, category: 'health' });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.error.details.some((d) => d.path === 'partnerId'));
  assert.equal(partnerId, null);
});
