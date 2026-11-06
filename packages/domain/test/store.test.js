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

test('BR-STORE-009 sugestão de categoria e de pet pelo nome do produto', async () => {
  const { suggestCategory, suggestPetType } = await import('../src/index.js');
  const cases = [
    ['Ração Úmida GranPlus Menu para Cães Adultos Sachê Sabor Carne', 'food', 'dog'],
    ['Areia Higiênica para Gatos 4kg', 'hygiene', 'cat'],
    ['Bifinho Sabor Carne 65g', 'treats', null],
    ['Bolinha de Tênis para Cachorro', 'toys', 'dog'],
    ['Antipulgas para Cães de 10 a 20 kg', 'health', 'dog'],
    ['Cama Pet Retangular Cinza', 'beds', null],
    ['Coleira Ajustável Azul', 'accessories', null],
    ['Mistura de Sementes para Calopsitas', 'food', 'bird'],
    ['Comedouro Inox para Cães e Gatos', 'accessories', null],
    ['Produto misterioso', null, null],
  ];
  for (const [name, category, pet] of cases) {
    assert.equal(suggestCategory(name), category, `${name} (categoria)`);
    assert.equal(suggestPetType(name), pet, `${name} (pet)`);
  }
});

test('BR-STORE-012 domínio do link: sem www, sem maiúsculas, só http(s)', async () => {
  const { siteDomain, sameSite } = await import('../src/store.js');
  assert.equal(siteDomain('https://www.Cobasi.com.br/racao/p?idsku=1'), 'cobasi.com.br');
  assert.equal(siteDomain('http://petz.com.br'), 'petz.com.br');
  assert.equal(siteDomain('javascript:alert(1)'), null);
  assert.equal(siteDomain(''), null);
  assert.equal(sameSite('https://www.cobasi.com.br/x/p', 'https://cobasi.com.br'), true);
  assert.equal(sameSite('https://loja.petz.com.br/x', 'https://www.petz.com.br'), true); // subdomínio da loja
  assert.equal(sameSite('https://www.petz.com.br/x', 'https://loja.petz.com.br'), false);
  assert.equal(sameSite('https://naocobasi.com.br/x', 'https://cobasi.com.br'), false); // não é subdomínio
  assert.equal(sameSite('https://cobasi.com.br/x', null), false);
});

test('BR-STORE-012 escolhe o parceiro: um só, vários (ativo e nome do vendedor) e nenhum', async () => {
  const { matchPartnersBySite } = await import('../src/store.js');
  const link = 'https://www.cobasi.com.br/antipulgas/p?idsku=779423';
  const partners = [
    { id: 1, name: 'Petz Mooca', website: 'https://www.petz.com.br', isActive: true },
    { id: 2, name: 'Cobasi Alto de Pinheiros', website: 'https://www.cobasi.com.br', isActive: false },
    { id: 3, name: 'Cobasi Santos', website: 'https://www.cobasi.com.br', isActive: true },
    { id: 4, name: 'Cobasi', website: 'https://cobasi.com.br/', isActive: true },
    { id: 5, name: 'Sem site', website: null, isActive: true },
  ];
  const all = matchPartnersBySite(link, partners, 'Cobasi');
  assert.deepEqual(all.matches.map((p) => p.id), [2, 3, 4]);
  assert.equal(all.chosen.id, 4); // nome igual ao vendedor
  assert.equal(matchPartnersBySite(link, partners.slice(0, 3), 'Cobasi').chosen.id, 3); // inativo fica de fora
  assert.equal(matchPartnersBySite(link, partners.slice(0, 3), null).chosen.id, 3);
  assert.equal(matchPartnersBySite(link, partners.slice(0, 2)).chosen.id, 2); // só inativo: ainda sugere
  const none = matchPartnersBySite('https://www.amazon.com.br/x', partners);
  assert.deepEqual(none, { matches: [], chosen: null, by: null });
});

test('BR-STORE-013 "Vendido e entregue por": vendedor do produto, senão o parceiro', async () => {
  const { soldBy } = await import('../src/store.js');
  assert.equal(soldBy({ sellerName: 'Cobasi' }, { name: 'Cobasi Santos' }), 'Cobasi');
  assert.equal(soldBy({ sellerName: '  ' }, { name: 'Cobasi Santos' }), 'Cobasi Santos');
  assert.equal(soldBy({ sellerName: null }, null), null);
});

test('BR-STORE-012 sem site cadastrado: acha o parceiro pelo nome da loja ou do domínio', async () => {
  const { matchPartnersBySite } = await import('../src/store.js');
  const partners = [
    { id: 1, name: 'PetCenter Curitiba', website: null, isActive: true },
    { id: 2, name: 'Zee.Dog Store', website: '', isActive: true },
    { id: 3, name: 'Petz Mooca', website: 'https://www.petz.com.br', isActive: true },
  ];
  const byDomain = matchPartnersBySite('https://www.petcenter.com.br/racao/p', partners, null, null);
  assert.deepEqual([byDomain.chosen?.id, byDomain.by], [1, 'name']);
  const bySeller = matchPartnersBySite('https://www.zeedog.com.br/produto/x', partners, 'Zee.Dog', 'Zee.Dog - Conectando');
  assert.deepEqual([bySeller.chosen?.id, bySeller.by], [2, 'name']);
  // parceiro com outro site é outra loja, mesmo com nome parecido
  assert.equal(matchPartnersBySite('https://www.petzzz.com.br/x', partners, 'Petz', null).chosen, null);
  assert.equal(matchPartnersBySite('https://www.amazon.com.br/x', partners).chosen, null);
});

test('BR-STORE-012 nome e site da loja nova: vendedor → og:site_name sem slogan → domínio', async () => {
  const { storeNameFor, siteOrigin, domainLabel } = await import('../src/store.js');
  assert.equal(storeNameFor({ sellerName: 'Hiperzoo', siteName: 'Hiperzoo Pet', url: 'https://www.hiperzoo.com.br/x' }), 'Hiperzoo');
  assert.equal(storeNameFor({ sellerName: null, siteName: 'Zee.Dog - Conectando pessoas', url: 'https://www.zeedog.com.br/x' }), 'Zee.Dog');
  assert.equal(storeNameFor({ sellerName: '', siteName: 'laicao.com.br', url: 'https://www.laicao.com.br/x' }), 'Laicao');
  assert.equal(storeNameFor({ url: 'https://petshop.drhato.com.br/x' }), 'Drhato');
  assert.equal(storeNameFor({}), null);
  assert.equal(siteOrigin('https://www.laicao.com.br/2021-12-10?x=1'), 'https://www.laicao.com.br');
  assert.equal(siteOrigin('javascript:alert(1)'), null);
  assert.equal(domainLabel('https://loja.exemplo.com.br/p'), 'exemplo');
});

test('BR-STORE-015 navegador do admin baixa só de servidores de fotos da lista, por https', async () => {
  const { browserCanFetchImage, BROWSER_IMAGE_HOSTS } = await import('../src/store.js');
  assert.ok(BROWSER_IMAGE_HOSTS.length > 0);
  assert.equal(browserCanFetchImage('https://cobasi.vteximg.com.br/arquivos/ids/1-1200-1200/a.webp?v=1'), true);
  assert.equal(browserCanFetchImage('https://americanas.vtexassets.com/arquivos/ids/37/a.jpg'), true);
  assert.equal(browserCanFetchImage('http://cobasi.vteximg.com.br/a.webp'), false); // só https
  assert.equal(browserCanFetchImage('https://vteximg.com.br.golpe.com/a.webp'), false);
  assert.equal(browserCanFetchImage('https://vteximg.com.br/a.webp'), false); // só subdomínio
  assert.equal(browserCanFetchImage('https://images.tcdn.com.br/a.jpg'), false); // fora da lista: envio manual
  assert.equal(browserCanFetchImage('nao-e-link'), false);
});
