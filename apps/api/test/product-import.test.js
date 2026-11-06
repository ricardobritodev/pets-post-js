/**
 * Importar produto de um link — BR-STORE-009/010. Sem rede: DNS e "servidor" falsos.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import zlib from 'node:zlib';
import { createSafeFetcher, parseSafeUrl, isPublicAddress, SafeFetchError, USER_AGENT, networkError } from '../src/lib/safe-fetch.js';
import { parseProductPage, decodeEntities, largerImage, cleanProductName } from '../src/lib/product-page.js';
import { createProductImporter, decodeHtml } from '../src/modules/store/importer.js';
import sharp from 'sharp';

// ---------- busca segura ----------

test('BR-STORE-010 só https na porta padrão, sem usuário/senha nem nomes internos', () => {
  assert.equal(parseSafeUrl('https://loja.com.br/p/1#x').toString(), 'https://loja.com.br/p/1');
  assert.equal(parseSafeUrl('https://8.8.8.8/x').hostname, '8.8.8.8'); // IP público pode
  for (const bad of ['http://loja.com.br/p', 'ftp://loja.com.br', 'https://loja.com.br:8443/p', 'https://user:senha@loja.com.br/',
    'https://localhost/p', 'https://intranet/p', 'https://impressora.local/', 'javascript:alert(1)', '', null,
    // IP escrito direto no link (o DNS não é consultado nesses casos)
    'https://169.254.169.254/latest/meta-data/', 'https://127.0.0.1/', 'https://10.0.0.1/', 'https://[::1]/', 'https://[::ffff:127.0.0.1]/']) {
    assert.throws(() => parseSafeUrl(bad), SafeFetchError, String(bad));
  }
});

test('BR-STORE-010 endereços internos são recusados (IPv4, IPv6 e IPv4 disfarçado)', () => {
  for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.3.4', '192.168.0.1', '169.254.169.254', '100.64.1.1', '0.0.0.0',
    '224.0.0.1', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.1.2.3', 'nao-e-ip']) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  for (const ip of ['8.8.8.8', '200.147.67.142', '2606:4700::6810:84e5']) assert.equal(isPublicAddress(ip), true, ip);
});

/** "Internet" falsa: hostname → IP e URL → resposta. Usa o lookup que o fetcher passa (como o https real). */
function fakeNet({ dnsTable, pages }) {
  const seen = [];
  const lookup = (host, _opts, cb) => (dnsTable[host] ? cb(null, dnsTable[host].map((address) => ({ address, family: address.includes(':') ? 6 : 4 }))) : cb(new Error('ENOTFOUND')));
  const request = (url, options, onResponse) => {
    const req = new EventEmitter();
    req.destroy = (err) => err && req.emit('error', err);
    req.end = () => {
      options.lookup(url.hostname, {}, (err, address) => {
        if (err) return req.emit('error', err);
        seen.push({ url: url.toString(), address, headers: options.headers });
        const page = pages[url.toString()] ?? { status: 404, body: 'nada' };
        let body = Buffer.from(page.body ?? '');
        const headers = { 'content-type': page.type ?? 'text/html; charset=utf-8', ...(page.location && { location: page.location }) };
        if (page.gzip) {
          body = zlib.gzipSync(body);
          headers['content-encoding'] = 'gzip';
        }
        const res = Readable.from([body]);
        res.statusCode = page.status ?? 200;
        res.headers = headers;
        onResponse(res);
      });
    };
    return req;
  };
  return { lookup, request, seen };
}

test('BR-STORE-010 baixa página pública, descompacta gzip e se identifica como Pets Post', async () => {
  const net = fakeNet({ dnsTable: { 'loja.com.br': ['200.1.2.3'] }, pages: { 'https://loja.com.br/p': { body: '<html>ok</html>', gzip: true } } });
  const { fetchUrl } = createSafeFetcher(net);
  const res = await fetchUrl('https://loja.com.br/p');
  assert.equal(res.body.toString(), '<html>ok</html>');
  assert.equal(res.status, 200);
  assert.equal(net.seen[0].address, '200.1.2.3');
  assert.equal(net.seen[0].headers['User-Agent'], USER_AGENT);
  assert.doesNotMatch(USER_AGENT, /Mozilla|Chrome|Safari/); // não se passa por navegador
  assert.match(USER_AGENT, /^[\x20-\x7e]+$/); // só ASCII: acento no cabeçalho faz CDN responder 400
});

test('BR-STORE-010 DNS que aponta para a rede interna é bloqueado antes de conectar', async () => {
  const net = fakeNet({ dnsTable: { 'malicioso.com': ['169.254.169.254'], 'misto.com': ['200.1.2.3', '10.0.0.1'] }, pages: {} });
  const { fetchUrl } = createSafeFetcher(net);
  await assert.rejects(fetchUrl('https://malicioso.com/x'), { code: 'BLOCKED_ADDRESS' });
  await assert.rejects(fetchUrl('https://misto.com/x'), { code: 'BLOCKED_ADDRESS' });
  assert.equal(net.seen.length, 0);
});

test('BR-STORE-010 redirecionamento é conferido a cada salto (http, rede interna, demais saltos)', async () => {
  const net = fakeNet({
    dnsTable: { 'loja.com.br': ['200.1.2.3'], 'interno.com': ['127.0.0.1'] },
    pages: {
      'https://loja.com.br/a': { status: 301, location: '/b' },
      'https://loja.com.br/b': { status: 302, location: 'https://loja.com.br/c' },
      'https://loja.com.br/c': { body: 'final' },
      'https://loja.com.br/para-http': { status: 301, location: 'http://loja.com.br/c' },
      'https://loja.com.br/para-interno': { status: 302, location: 'https://interno.com/admin' },
      'https://loja.com.br/loop': { status: 302, location: '/loop' },
    },
  });
  const { fetchUrl } = createSafeFetcher(net);
  const ok = await fetchUrl('https://loja.com.br/a');
  assert.equal(ok.url, 'https://loja.com.br/c');
  assert.equal(ok.body.toString(), 'final');
  await assert.rejects(fetchUrl('https://loja.com.br/para-http'), { code: 'INVALID_URL' });
  await assert.rejects(fetchUrl('https://loja.com.br/para-interno'), { code: 'BLOCKED_ADDRESS' });
  await assert.rejects(fetchUrl('https://loja.com.br/loop'), { code: 'TOO_MANY_REDIRECTS' });
});

test('BR-STORE-010 resposta grande demais é cortada', async () => {
  const net = fakeNet({ dnsTable: { 'loja.com.br': ['200.1.2.3'] }, pages: { 'https://loja.com.br/grande': { body: 'x'.repeat(5000) } } });
  const { fetchUrl } = createSafeFetcher(net);
  await assert.rejects(fetchUrl('https://loja.com.br/grande', { maxBytes: 1000 }), { code: 'TOO_LARGE' });
});

// ---------- leitura da página ----------

const LD_PAGE = `<html><head>
<title>Ração X | Loja</title>
<link rel="canonical" href="https://loja.com.br/produto/racao-x" />
<meta property="og:site_name" content="Loja Exemplo" />
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"BreadcrumbList"},
 {"@type":"Product","name":"Ração Úmida &amp; Saborosa para Cães Adultos Sachê","description":"<p>Alimento completo.</p><br>Rico em proteínas.",
  "image":["/img/1.jpg",{"@type":"ImageObject","url":"https://cdn.loja.com.br/2.jpg"},"http://inseguro.com/3.jpg"],
  "offers":{"@type":"Offer","price":"3.49","priceCurrency":"BRL","availability":"https://schema.org/InStock"}}]}</script>
</head><body></body></html>`;

test('BR-STORE-009 lê o Product do JSON-LD (com @graph, imagens relativas e HTML na descrição)', () => {
  const p = parseProductPage(LD_PAGE, 'https://loja.com.br/produto/racao-x?utm=1');
  assert.equal(p.source, 'json-ld');
  assert.equal(p.name, 'Ração Úmida & Saborosa para Cães Adultos Sachê');
  assert.equal(p.description, 'Alimento completo.\nRico em proteínas.');
  assert.equal(p.priceCents, 349);
  assert.equal(p.inStock, true);
  assert.deepEqual(p.imageUrls, ['https://loja.com.br/img/1.jpg', 'https://cdn.loja.com.br/2.jpg']); // http é descartado
  assert.equal(p.url, 'https://loja.com.br/produto/racao-x'); // canonical, sem utm
  assert.equal(p.siteName, 'Loja Exemplo');
});

test('BR-STORE-009 AggregateOffer usa o menor preço; esgotado vira inStock false', () => {
  const html = `<script type="application/ld+json">[{"@type":["Product"],"name":"Arranhador",
    "offers":{"@type":"AggregateOffer","lowPrice":129.9,"highPrice":199.9,"availability":"http://schema.org/OutOfStock"}}]</script>`;
  const p = parseProductPage(html, 'https://loja.com.br/arranhador');
  assert.equal(p.priceCents, 12990);
  assert.equal(p.inStock, false);
});

test('BR-STORE-009 sem JSON-LD: usa Open Graph e meta de preço', () => {
  const html = `<head><meta property="og:title" content="Bolinha com Guizo" /><meta property="og:description" content="Brinquedo &quot;resistente&quot;" />
    <meta property="og:image" content="https://cdn.loja.com.br/bola.jpg" /><meta property="product:price:amount" content="15,90" />
    <meta property="product:availability" content="in stock" /></head>`;
  const p = parseProductPage(html, 'https://loja.com.br/bola');
  assert.equal(p.source, 'meta');
  assert.deepEqual([p.name, p.description, p.priceCents, p.inStock], ['Bolinha com Guizo', 'Brinquedo "resistente"', 1590, true]);
  assert.deepEqual(p.imageUrls, ['https://cdn.loja.com.br/bola.jpg']);
  assert.equal(p.siteName, 'loja.com.br');
});

test('BR-STORE-009 JSON-LD quebrado é ignorado; página sem nada → null', () => {
  const broken = '<script type="application/ld+json">{ isso não é json }</script><meta property="og:type" content="product" /><meta property="og:title" content="Só o título" />';
  assert.equal(parseProductPage(broken, 'https://loja.com.br/x').name, 'Só o título');
  assert.equal(parseProductPage('<html><body>vazio</body></html>', 'https://loja.com.br/x'), null);
  assert.equal(decodeEntities('&#233;&#xE7;&amp;&lt;b&gt;'), 'éç&<b>');
});

/** Página no formato da VTEX (Cobasi): ProductGroup com uma variação por sku, vendedor na oferta. */
const GROUP_PAGE = `<link rel="canonical" href="https://www.loja.com.br/antipulgas-x/p" />
<script type="application/ld+json">{"@context":"https://schema.org","@type":"ProductGroup","name":"Antipulgas X Cães 11 a 22kg",
  "description":"Comprimido mastigável.","url":"https://www.loja.com.br/antipulgas-x/p","hasVariant":[
  {"@type":"Product","name":"Antipulgas X Cães 11 a 22kg 1 comprimido","sku":"1001590","image":"https://img.loja.com.br/1 comprimido.webp",
   "url":"https://www.loja.com.br/antipulgas-x/p?idsku=1001590",
   "offers":{"@type":"Offer","price":"74.90","availability":"https://schema.org/InStock","seller":{"@type":"Organization","name":"Loja Pet"}}},
  {"@type":"Product","name":"Antipulgas X Cães 11 a 22kg 3 comprimidos","sku":"779423","image":"https://img.loja.com.br/3 comprimidos.webp",
   "url":"https://www.loja.com.br/antipulgas-x/p?idsku=779423",
   "offers":{"@type":"Offer","price":"177.90","availability":"https://schema.org/OutOfStock","seller":{"@type":"Organization","name":"Loja Pet"}}}]}</script>`;

test('BR-STORE-009 ProductGroup: vale a variação que o link aponta (nome, preço, foto e link dela)', () => {
  const p = parseProductPage(GROUP_PAGE, 'https://www.loja.com.br/antipulgas-x/p?idsku=779423');
  assert.equal(p.name, 'Antipulgas X Cães 11 a 22kg 3 comprimidos');
  assert.equal(p.priceCents, 17790);
  assert.equal(p.inStock, false);
  assert.deepEqual(p.imageUrls, ['https://img.loja.com.br/3%20comprimidos.webp']);
  assert.equal(p.url, 'https://www.loja.com.br/antipulgas-x/p?idsku=779423'); // não volta para o canonical do grupo
});

test('BR-STORE-009 ProductGroup: sku em outro parâmetro também acha; sem variação no link fica a primeira com o nome do grupo', () => {
  assert.equal(parseProductPage(GROUP_PAGE, 'https://www.loja.com.br/antipulgas-x/p?sku=1001590&utm_source=x').priceCents, 7490);
  const p = parseProductPage(GROUP_PAGE, 'https://www.loja.com.br/antipulgas-x/p');
  assert.equal(p.name, 'Antipulgas X Cães 11 a 22kg');
  assert.equal(p.priceCents, 7490);
  assert.equal(p.url, 'https://www.loja.com.br/antipulgas-x/p');
});

test('BR-STORE-013 vendedor vem do offers.seller (objeto ou texto); sem ele, null', () => {
  assert.equal(parseProductPage(GROUP_PAGE, 'https://www.loja.com.br/antipulgas-x/p?idsku=779423').sellerName, 'Loja Pet');
  const asText = '<script type="application/ld+json">{"@type":"Product","name":"Bola","offers":{"price":"10","seller":"Parceiro &amp; Cia"}}</script>';
  assert.equal(parseProductPage(asText, 'https://loja.com.br/bola').sellerName, 'Parceiro & Cia');
  assert.equal(parseProductPage(LD_PAGE, 'https://loja.com.br/produto/racao-x').sellerName, null);
});

// ---------- fotos: tamanho, uma leitura por foto e limite do site ----------

test('BR-STORE-009 miniatura da VTEX vira a foto de 1200 px; outras URLs não mudam', () => {
  assert.equal(largerImage('https://cobasi.vteximg.com.br/arquivos/ids/1078038-194-194/Coleira_1.webp?v=6'),
    'https://cobasi.vteximg.com.br/arquivos/ids/1078038-1200-1200/Coleira_1.webp?v=6');
  assert.equal(largerImage('https://x.vteximg.com.br/arquivos/ids/5-1500-1500/a.jpg'), 'https://x.vteximg.com.br/arquivos/ids/5-1500-1500/a.jpg');
  assert.equal(largerImage('https://loja.com.br/img/194-194/a.jpg'), 'https://loja.com.br/img/194-194/a.jpg');
  const html = '<meta property="og:type" content="product" /><meta property="og:title" content="Coleira" /><meta property="og:image" content="https://cobasi.vteximg.com.br/arquivos/ids/9-194-194/c.webp" />';
  assert.deepEqual(parseProductPage(html, 'https://www.cobasi.com.br/c/p').imageUrls, ['https://cobasi.vteximg.com.br/arquivos/ids/9-1200-1200/c.webp']);
});

/** Fetcher falso: página com 3 fotos; `status` decide a resposta de cada foto. */
async function photoShop(status) {
  const png = await sharp({ create: { width: 900, height: 900, channels: 3, background: '#3366ff' } }).png().toBuffer();
  const imgs = ['a', 'b', 'c'].map((n) => `https://cdn.loja.com.br/${n}.png`);
  const page = `<script type="application/ld+json">{"@type":"Product","name":"Coleira Antiparasitária","image":${JSON.stringify(imgs)},
    "offers":{"price":"68.90","availability":"https://schema.org/InStock"}}</script>`;
  const calls = [];
  const fetcher = {
    async fetchUrl(url) {
      calls.push(url);
      if (url === 'https://loja.com.br/coleira') return { url, status: 200, contentType: 'text/html', body: Buffer.from(page) };
      const st = status(url);
      return st === 200 ? { url, status: 200, contentType: 'image/png', body: png } : { url, status: st, contentType: 'text/plain', body: Buffer.from('Too Many Requests') };
    },
  };
  return { fetcher, calls, imgs };
}

test('BR-STORE-010 cada foto é baixada uma vez: a do rascunho é reaproveitada ao salvar (até 15 min)', async () => {
  const { fetcher, calls, imgs } = await photoShop(() => 200);
  let clock = 0;
  const importer = createProductImporter({ fetcher, now: () => clock });
  const { images, warnings } = await importer.draft('https://loja.com.br/coleira');
  assert.equal(images.length, 3);
  assert.deepEqual(warnings, []);
  assert.equal(calls.length, 4); // página + 3 fotos

  const { files, rejected } = await importer.downloadImages(imgs.slice(0, 2));
  assert.equal(files.length, 2);
  assert.deepEqual(rejected, []);
  assert.equal(calls.length, 4); // nada pedido de novo

  clock += 15 * 60 * 1000 + 1; // passou do prazo: baixa de novo
  await importer.downloadImages([imgs[2]]);
  assert.equal(calls.length, 5);
});

test('BR-STORE-010 site responde 429 nas fotos: para no primeiro e avisa para tentar depois ou enviar à mão', async () => {
  const { fetcher, calls, imgs } = await photoShop((url) => (url.endsWith('a.png') ? 200 : 429));
  const importer = createProductImporter({ fetcher });
  const { images, warnings } = await importer.draft('https://loja.com.br/coleira');
  assert.equal(images.length, 1);
  assert.equal(calls.length, 3); // página, a.png e b.png (429) — c.png nem é pedida
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /limitou o acesso de robôs às fotos agora \(429\) e algumas fotos ficaram de fora/);

  calls.length = 0;
  const { files, rejected } = await importer.downloadImages(imgs);
  assert.equal(files.length, 1); // a.png veio guardada do rascunho
  assert.deepEqual(rejected.map((r) => r.name), ['b.png', 'c.png']);
  assert.match(rejected[0].message, /^Não consegui baixar: o site cdn\.loja\.com\.br limitou o acesso de robôs/);
  assert.deepEqual(calls, ['https://cdn.loja.com.br/b.png']); // depois do 429, c.png não é pedida
});

// ---------- BR-STORE-014: formatos reais das lojas (levantamento de 2026-11-06) ----------

const ld = (obj, attrs = 'type="application/ld+json"') => `<script ${attrs}>${typeof obj === 'string' ? obj : JSON.stringify(obj)}</script>`;

test('BR-STORE-014 JSON-LD com type sem aspas (Wake/Fbits) e com quebra de linha crua e vírgula sobrando (WooCommerce)', () => {
  const wake = ld({ '@type': 'Product', name: 'Bebedouro Vida Mansa 2 Litros', offers: { price: '80.65', availability: 'https://schema.org/OutOfStock' } }, 'type=application/ld+json');
  const p = parseProductPage(wake, 'https://www.tudodebicho.com.br/produto/bebedouro-164670');
  assert.deepEqual([p.source, p.priceCents, p.inStock], ['json-ld', 8065, false]);

  const woo = ld('{\n "@type": "Product",\n "name": "Ração Origens 15kg",\n "description": "Linha premium\nespecial",\n "offers": {"price": "184.99",},\n}');
  const w = parseProductPage(woo, 'https://terrazoo.com.br/produto/racao-origens/');
  assert.deepEqual([w.source, w.name, w.priceCents, w.description], ['json-ld', 'Ração Origens 15kg', 18499, 'Linha premium especial']);
});

test('BR-STORE-014 Product dentro de outro objeto (Zee.Dog) e preço "por" do priceSpecification', () => {
  const html = ld({ '@type': 'ProductDetailsPage', breadcrumbList: { '@type': 'BreadcrumbList' }, product: {
    '@type': 'ProductGroup', name: 'Comedouro Tuff Bowl', url: 'https://www.zeedog.com.br/produto/comedouro?id=621943',
    hasVariant: [{ '@type': 'Product', name: 'Comedouro Tuff Bowl 1.2L', sku: '37382', url: 'https://www.zeedog.com.br/produto/comedouro?id=621943',
      offers: { '@type': 'Offer', availability: 'https://schema.org/InStock', seller: { '@type': 'Organization', name: 'Zee.Dog' },
        priceSpecification: [{ priceType: 'https://schema.org/ListPrice', price: 299 }, { priceType: 'https://schema.org/SalePrice', price: 249 }] } }] } });
  const p = parseProductPage(html, 'https://www.zeedog.com.br/produto/comedouro?id=621943');
  assert.deepEqual([p.name, p.priceCents, p.inStock, p.sellerName], ['Comedouro Tuff Bowl 1.2L', 24900, true, 'Zee.Dog']);
});

test('BR-STORE-014 vários Product: o da página vence os relacionados; blocos repetidos do mesmo produto se completam', () => {
  const html = ld({ '@type': 'ItemList', itemListElement: [{ '@type': 'Product', name: 'Outro produto', offers: { price: '9.90' } }] })
    + ld({ '@type': 'Product', name: 'Ração X 15kg', url: 'https://loja.com.br/racao-x/', offers: { price: '184.99' },
      isRelatedTo: { '@type': 'Product', name: 'Relacionado', url: 'https://loja.com.br/rel/', offers: { price: '1.00' } } })
    + ld({ '@type': 'Product', name: 'Ração X 15kg - Loja', offers: { price: '184.99', seller: { '@type': 'Organization', name: 'Loja Pet' } } });
  const p = parseProductPage(html, 'https://loja.com.br/racao-x/');
  assert.deepEqual([p.name, p.priceCents, p.sellerName], ['Ração X 15kg', 18499, 'Loja Pet']);
});

test('BR-STORE-014 preço zero não é preço; vendedor só com número (id) é ignorado', () => {
  const tray = ld({ '@type': 'Product', name: 'Drontal Plus 10 kg', offers: { price: '0.00', availability: ' http://schema.org/InStock', seller: { name: '1' } } })
    + '<meta property="product:price:amount" content="89.90" />';
  const p = parseProductPage(tray, 'https://www.petcaesecia.com.br/drontal-54919');
  assert.deepEqual([p.priceCents, p.inStock, p.sellerName], [8990, true, null]); // o meta completa o preço
});

test('BR-STORE-014 VTEX antiga sem JSON-LD: lê o skuJson (preço em centavos, sku do link, vendedor, foto grande)', () => {
  const sku = (n, price, available) => ({ sku: n, skuname: `SKU ${n}`, bestPrice: price, available, image: `https://x.vteximg.com.br/arquivos/ids/${n}-292-292/f.jpg`, seller: 'PET SHOP DR HATO LIMITADA' });
  const html = `<title>RACAO GOLDEN - Dr. Hato</title><script>var skuJson_0 = ${JSON.stringify({ productId: 5899, name: 'Ração Golden Mega 15kg "Frango"', available: true,
    skus: [sku(6070, 17490, true), sku(6071, 0, false)] })};CATALOG_SDK.setProductWithVariationsCache(skuJson_0.productId, skuJson_0);</script>`;
  const p = parseProductPage(html, 'https://petshop.drhato.com.br/racao-golden/p');
  assert.deepEqual([p.source, p.name, p.priceCents, p.inStock, p.sellerName], ['vtex', 'Ração Golden Mega 15kg "Frango"', 17490, true, 'PET SHOP DR HATO LIMITADA']);
  assert.deepEqual(p.imageUrls, ['https://x.vteximg.com.br/arquivos/ids/6070-1200-1200/f.jpg']);
  const other = parseProductPage(html, 'https://petshop.drhato.com.br/racao-golden/p?idsku=6071');
  assert.deepEqual([other.priceCents, other.inStock], [null, false]);
});

test('BR-STORE-014 microdados em qualquer tag (Loja Integrada); itemprop image só sem og:image', () => {
  const html = `<meta property="og:title" content="Pet Dog Crock Mini" /><meta property="og:image" content="https://cdn.awsli.com.br/800x800/1/produto/1/a.jpg" />
    <div itemscope itemtype="http://schema.org/Product"><span itemprop="price" content="35.99"></span>
    <link itemprop="availability" href="http://schema.org/InStock" /><img itemprop="image" src="https://cdn.awsli.com.br/300x300/1/produto/1/a.jpg" />
    <img itemprop="image" src="https://cdn.awsli.com.br/300x300/1/produto/999/relacionado.jpg" /></div>`;
  const p = parseProductPage(html, 'https://www.laicao.com.br/2021-12-10-16-00-54');
  assert.deepEqual([p.source, p.priceCents, p.inStock], ['meta', 3599, true]);
  assert.deepEqual(p.imageUrls, ['https://cdn.awsli.com.br/800x800/1/produto/1/a.jpg']);
});

test('BR-STORE-014 a mesma foto em tamanhos diferentes conta uma vez', () => {
  const html = ld({ '@type': 'Product', name: 'Coleira', offers: { price: '10' }, image: [
    'https://cdn.awsli.com.br/800x800/1/produto/7/a.jpg', 'https://cdn.awsli.com.br/300x300/1/produto/7/a.jpg',
    'https://img.loja.com.br/p/b.jpg?w=824&h=824', 'https://img.loja.com.br/p/b.jpg?w=100&h=100', 'https://img.loja.com.br/p/c.jpg'] });
  assert.deepEqual(parseProductPage(html, 'https://loja.com.br/coleira').imageUrls,
    ['https://cdn.awsli.com.br/800x800/1/produto/7/a.jpg', 'https://img.loja.com.br/p/b.jpg?w=824&h=824', 'https://img.loja.com.br/p/c.jpg']);
});

test('BR-STORE-014 nome sem o sufixo da loja ou propaganda; o resto do nome fica', () => {
  const at = (name, url, siteName) => cleanProductName(name, { pageUrl: url, siteName });
  assert.equal(at('Base Matte PAYOT 30 ml | Amazon.com.br', 'https://www.amazon.com.br/dp/B0D7', 'Amazon.com.br'), 'Base Matte PAYOT 30 ml');
  assert.equal(at('Comedouro Tuff Bowl | Zee.Dog - Conectando pessoas e pets', 'https://www.zeedog.com.br/p', 'Zee.Dog'), 'Comedouro Tuff Bowl');
  assert.equal(at('Bebedouro Vida Mansa 2 Litros - Frete Rápido', 'https://www.tudodebicho.com.br/p', null), 'Bebedouro Vida Mansa 2 Litros');
  assert.equal(at('Ração Golden 15KG - Dr. Hato', 'https://petshop.drhato.com.br/p', null), 'Ração Golden 15KG');
  assert.equal(at('Ração Origens 15+1Kg Grátis Adimax -', 'https://terrazoo.com.br/p', 'Terra Zoo'), 'Ração Origens 15+1Kg Grátis Adimax');
  // hífen que é do nome do produto continua
  assert.equal(at('Coleira com Identificação - Tecido Macio Vermelho', 'https://www.petelegante.com.br/p', 'Pet Elegante'), 'Coleira com Identificação - Tecido Macio Vermelho');
  assert.equal(at('Coleira Zee.Dog - Preta', 'https://www.zeedog.com.br/p', 'Zee.Dog'), 'Coleira Zee.Dog - Preta');
});

test('BR-STORE-014 página sem nada de produto (blog, institucional) → null', () => {
  const blog = '<meta property="og:type" content="article" /><meta property="og:title" content="8 raças de cachorro para apartamento" />'
    + ld({ '@graph': [{ '@type': 'Article', headline: '8 raças' }, { '@type': 'WebPage' }] });
  assert.equal(parseProductPage(blog, 'https://www.bichosecaprichos.com.br/8-racas/'), null);
  assert.equal(parseProductPage('<meta property="og:title" content="Seja um Franqueado" />', 'https://petlandbrasil.com.br/franqueado/'), null);
});

test('BR-STORE-014 página grande é lida até o limite (truncate); foto grande continua recusada', async () => {
  const page = `<head><meta property="og:type" content="product" /><meta property="og:title" content="Ração" /></head>${'x'.repeat(5000)}`;
  const net = fakeNet({ dnsTable: { 'loja.com.br': ['200.1.2.3'] }, pages: { 'https://loja.com.br/grande': { body: page } } });
  const { fetchUrl } = createSafeFetcher(net);
  const res = await fetchUrl('https://loja.com.br/grande', { maxBytes: 1000, truncate: true });
  assert.equal(res.body.length, 1000);
  assert.equal(res.truncated, true);
  assert.equal(parseProductPage(res.body.toString(), res.url).name, 'Ração');
  await assert.rejects(fetchUrl('https://loja.com.br/grande', { maxBytes: 1000 }), { code: 'TOO_LARGE' });
});

test('BR-STORE-014 charset: cabeçalho, senão o <meta> da página, senão utf-8', () => {
  const latin = Buffer.from('<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1" /><h1>Ra\xe7\xe3o</h1>', 'latin1');
  assert.match(decodeHtml(latin, 'text/html'), /Ração/);
  assert.match(decodeHtml(Buffer.from('<meta charset="ISO-8859-1"><p>C\xe3es</p>', 'latin1'), ''), /Cães/);
  assert.match(decodeHtml(Buffer.from('<h1>Ração</h1>'), 'text/html'), /Ração/);
  assert.match(decodeHtml(Buffer.from('<h1>Ra\xe7\xe3o</h1>', 'latin1'), 'text/html; charset=ISO-8859-1'), /Ração/);
});

test('BR-STORE-014 erro de certificado tem mensagem própria; nunca desliga a conferência', () => {
  assert.equal(networkError({ code: 'ERR_TLS_CERT_ALTNAME_INVALID' }).code, 'TLS_INVALID');
  assert.match(networkError({ code: 'CERT_HAS_EXPIRED' }).message, /certificado de segurança desse site é inválido/);
  assert.equal(networkError({ code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' }).code, 'TLS_UNVERIFIED');
  assert.equal(networkError({ code: 'ECONNREFUSED' }).message, 'O site recusou a conexão.');
  assert.equal(networkError(new Error('x')).code, 'NETWORK');
  const net = fakeNet({ dnsTable: {}, pages: {} });
  const seen = [];
  createSafeFetcher({ ...net, request: (url, options) => { seen.push(options); return net.request(url, options, () => {}); } })
    .fetchUrl('https://loja.com.br/x').catch(() => {});
  assert.notEqual(seen[0]?.rejectUnauthorized, false);
});

test('BR-STORE-015 429 em servidor de fotos da lista (VTEX): as fotos que faltam vão para o navegador baixar', async () => {
  const png = await sharp({ create: { width: 900, height: 900, channels: 3, background: '#3366ff' } }).png().toBuffer();
  const imgs = ['https://loja.vteximg.com.br/arquivos/ids/1/a.png', 'https://loja.vteximg.com.br/arquivos/ids/2/b.png', 'https://loja.vteximg.com.br/arquivos/ids/3/c.png'];
  const page = `<script type="application/ld+json">{"@type":"Product","name":"Coleira","image":${JSON.stringify(imgs)},"offers":{"price":"68.90"}}</script>`;
  const fetcher = {
    async fetchUrl(url) {
      if (url === 'https://loja.com.br/coleira') return { url, status: 200, contentType: 'text/html', body: Buffer.from(page) };
      return url.endsWith('a.png') ? { url, status: 200, contentType: 'image/png', body: png } : { url, status: 429, contentType: 'text/plain', body: Buffer.from('') };
    },
  };
  const { images, pendingImages, warnings } = await createProductImporter({ fetcher }).draft('https://loja.com.br/coleira');
  assert.equal(images.length, 1);
  assert.deepEqual(pendingImages, imgs.slice(1));
  assert.deepEqual(warnings, []); // o front avisa se o navegador também não conseguir

  const outra = { async fetchUrl(url) {
    if (url === 'https://loja.com.br/coleira') return { url, status: 200, contentType: 'text/html', body: Buffer.from(page.replaceAll('loja.vteximg.com.br', 'cdn.loja.com.br')) };
    return { url, status: 429, contentType: 'text/plain', body: Buffer.from('') };
  } };
  const semLista = await createProductImporter({ fetcher: outra }).draft('https://loja.com.br/coleira');
  assert.deepEqual(semLista.pendingImages, []); // fora da lista: envio manual
  assert.match(semLista.warnings[0], /envie as fotos à mão/);
});
