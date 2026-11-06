/**
 * Importar produto de um link — BR-STORE-009/010. Sem rede: DNS e "servidor" falsos.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import zlib from 'node:zlib';
import { createSafeFetcher, parseSafeUrl, isPublicAddress, SafeFetchError, USER_AGENT } from '../src/lib/safe-fetch.js';
import { parseProductPage, decodeEntities } from '../src/lib/product-page.js';

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
  const broken = '<script type="application/ld+json">{ isso não é json }</script><meta property="og:title" content="Só o título" />';
  assert.equal(parseProductPage(broken, 'https://loja.com.br/x').name, 'Só o título');
  assert.equal(parseProductPage('<html><body>vazio</body></html>', 'https://loja.com.br/x'), null);
  assert.equal(decodeEntities('&#233;&#xE7;&amp;&lt;b&gt;'), 'éç&<b>');
});
