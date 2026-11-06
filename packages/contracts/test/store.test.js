import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productSchema, updateProductSchema, storeQuerySchema } from '../src/index.js';

const valid = { partnerId: 3, name: 'Ração Premium 10 kg', category: 'food', priceCents: 18990 };

test('BR-STORE-006 produto: obrigatórios e padrões', () => {
  const ok = productSchema.parse(valid);
  assert.deepEqual(
    { stock: ok.stock, isActive: ok.isActive, isFeatured: ok.isFeatured, petType: ok.petType, promo: ok.promoPriceCents, url: ok.url },
    { stock: 0, isActive: true, isFeatured: false, petType: null, promo: null, url: null },
  );
  const bad = productSchema.safeParse({});
  assert.deepEqual(bad.error.issues.map((i) => i.path[0]).sort(), ['category', 'name', 'partnerId', 'priceCents']);
});

test('BR-STORE-003 preço em centavos inteiros, promoção menor que o preço', () => {
  assert.equal(productSchema.safeParse({ ...valid, priceCents: 189.9 }).success, false);
  assert.equal(productSchema.safeParse({ ...valid, priceCents: 0 }).success, false);
  assert.equal(productSchema.safeParse({ ...valid, priceCents: 10_000_001 }).success, false);
  assert.equal(productSchema.parse({ ...valid, promoPriceCents: 15990 }).promoPriceCents, 15990);
  const promo = productSchema.safeParse({ ...valid, promoPriceCents: 18990 });
  assert.equal(promo.success, false);
  assert.deepEqual(promo.error.issues[0].path, ['promoPriceCents']);
  assert.equal(productSchema.parse({ ...valid, promoPriceCents: '' }).promoPriceCents, null);
});

test('BR-STORE-005 link do produto só http/https', () => {
  assert.equal(productSchema.parse({ ...valid, url: 'https://loja.com/p/1' }).url, 'https://loja.com/p/1');
  assert.equal(productSchema.safeParse({ ...valid, url: 'javascript:alert(1)' }).success, false);
});

test('PATCH de produto: subconjunto sem padrões; vazio → erro', () => {
  assert.deepEqual(updateProductSchema.parse({ stock: 5 }), { stock: 5 });
  assert.deepEqual(updateProductSchema.parse({ isFeatured: true }), { isFeatured: true });
  assert.equal(updateProductSchema.safeParse({}).success, false);
  assert.equal(updateProductSchema.safeParse({ priceCents: 1000, promoPriceCents: 1500 }).success, false);
});

test('vitrine: filtros inválidos ignorados, ordenação padrão "featured"', () => {
  assert.deepEqual(storeQuerySchema.parse({}), { sort: 'featured', page: 1 });
  const q = storeQuerySchema.parse({ category: 'toys', petType: 'peixe', sort: 'barato', partnerId: 'x', q: ' bola ' });
  assert.deepEqual(q, { category: 'toys', petType: undefined, partnerId: undefined, sort: 'featured', q: 'bola', page: 1 });
  assert.equal(storeQuerySchema.parse({ sort: 'price_asc', partnerId: '3' }).partnerId, 3);
});
