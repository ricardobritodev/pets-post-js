import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  finalPriceCents, discountPercent, hasPromo, buyLink, reaisToCents, formatBRL, centsToInput,
  productWhatsappMessage, label, PRODUCT_CATEGORIES,
} from '../src/index.js';

test('BR-STORE-002 categorias com rótulo', () => {
  assert.equal(PRODUCT_CATEGORIES.length, 7);
  for (const c of PRODUCT_CATEGORIES) assert.notEqual(label('productCategory', c), c);
  assert.equal(label('productCategory', 'food'), 'Ração');
});

test('BR-STORE-003 preço final e desconto arredondado para baixo', () => {
  assert.equal(finalPriceCents({ priceCents: 18990, promoPriceCents: 15990 }), 15990);
  assert.equal(discountPercent({ priceCents: 18990, promoPriceCents: 15990 }), 15); // 15,79% → 15
  assert.equal(discountPercent({ priceCents: 1000, promoPriceCents: 500 }), 50);
  // promoção igual ou maior que o preço não vale
  for (const promo of [18990, 20000, 0, null, undefined]) {
    const p = { priceCents: 18990, promoPriceCents: promo };
    assert.equal(hasPromo(p), false, String(promo));
    assert.equal(finalPriceCents(p), 18990);
    assert.equal(discountPercent(p), null);
  }
});

test('BR-STORE-005 link de compra: produto → site do parceiro → WhatsApp → nada', () => {
  const partner = { website: 'https://petshop.com.br', whatsappUrl: 'https://wa.me/5511' };
  assert.deepEqual(buyLink({ url: 'https://petshop.com.br/racao-10kg' }, partner), { url: 'https://petshop.com.br/racao-10kg', channel: 'product' });
  assert.deepEqual(buyLink({ url: null }, partner), { url: 'https://petshop.com.br', channel: 'site' });
  assert.deepEqual(buyLink({ url: 'javascript:alert(1)' }, partner), { url: 'https://petshop.com.br', channel: 'site' });
  assert.deepEqual(buyLink({}, { website: 'ftp://x', whatsappUrl: 'https://wa.me/5511' }), { url: 'https://wa.me/5511', channel: 'whatsapp' });
  assert.deepEqual(buyLink({}, { website: null, whatsappUrl: null }), { url: null, channel: null });
  assert.match(productWhatsappMessage('Ração X'), /\*Ração X\* no Pets Post/);
});

test('reais digitados → centavos (formato brasileiro)', () => {
  const cases = { '189,90': 18990, 'R$ 1.234,56': 123456, '189.90': 18990, '189': 18900, '0,5': 50, '1.234': 123400, ' 12,3 ': 1230 };
  for (const [text, cents] of Object.entries(cases)) assert.equal(reaisToCents(text), cents, text);
  for (const bad of ['', 'abc', '12,345', '1,2,3', '-10', null]) assert.equal(reaisToCents(bad), null, String(bad));
});

test('centavos → texto', () => {
  assert.equal(formatBRL(123456).replace(/\s/g, ' '), 'R$ 1.234,56');
  assert.equal(centsToInput(18990), '189,90');
  assert.equal(centsToInput(null), '');
});
