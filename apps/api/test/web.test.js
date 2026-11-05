// Unitário (sem banco): mapa de páginas, Open Graph (ADR 002) e Express servindo o build.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { resolvePage } from '@petspost/web/page-routes';
import { injectMeta, postMeta, escapeHtml, truncate, META_MARKER } from '../src/web/meta.js';
import { webRouter } from '../src/web/router.js';
import { HttpError } from '../src/middleware/errors.js';

test('resolvePage: URLs do sistema antigo continuam valendo', () => {
  assert.deepEqual(resolvePage('/posts/12'), { page: 'posts/detalhe.html', params: { id: '12' }, og: 'post' });
  assert.deepEqual(resolvePage('/posts/12/editar'), { page: 'posts/form.html', params: { id: '12' } });
  assert.equal(resolvePage('/posts/criar').page, 'posts/form.html');
  assert.equal(resolvePage('/posts').page, 'posts/index.html');
  assert.equal(resolvePage('/posts/').page, 'posts/index.html');
  assert.equal(resolvePage('/sobre').page, 'sobre/index.html');
  assert.equal(resolvePage('/').page, 'index.html');
  assert.equal(resolvePage('/posts/abc'), null);
  assert.equal(resolvePage('/qualquer'), null);
});

const post = {
  id: 7,
  title: 'Rex perdido no "parque" <Ibirapuera>',
  description: 'Fugiu domingo. '.repeat(30),
  statusLabel: 'Perdido',
  petTypeLabel: 'Cachorro',
  lastSeenLocation: 'São Paulo, SP',
  primaryPhoto: { url: '/uploads/rex.jpg' },
};

test('ADR 002 postMeta monta título, descrição curta e URLs absolutas', () => {
  const m = postMeta(post, 'https://www.petspost.com.br');
  assert.equal(m.title, 'Perdido: Rex perdido no "parque" <Ibirapuera> · Pets Post');
  assert.ok(m.description.length <= 200);
  assert.match(m.description, /^Cachorro · São Paulo, SP\. Fugiu/);
  assert.equal(m.url, 'https://www.petspost.com.br/posts/7');
  assert.equal(m.image, 'https://www.petspost.com.br/uploads/rex.jpg');
  assert.equal(postMeta({ ...post, primaryPhoto: null }).image, null);
});

test('ADR 002 injectMeta troca o <title>, insere og:* e escapa HTML (sem XSS)', () => {
  const html = `<head><title>Post · Pets Post</title>${META_MARKER}</head>`;
  const out = injectMeta(html, postMeta(post, 'https://x.com'));
  assert.match(out, /<title>Perdido: Rex perdido no &quot;parque&quot; &lt;Ibirapuera&gt; · Pets Post<\/title>/);
  assert.match(out, /<meta property="og:image" content="https:\/\/x\.com\/uploads\/rex\.jpg" \/>/);
  assert.match(out, /<meta name="twitter:card" content="summary_large_image" \/>/);
  assert.doesNotMatch(out, /<Ibirapuera>/);
  assert.doesNotMatch(out, new RegExp(META_MARKER));
});

test('escapeHtml e truncate', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.equal(truncate('curto', 10), 'curto');
  const t = truncate('palavra '.repeat(10), 20);
  assert.ok(t.length <= 20 && t.endsWith('…'));
});

// --- Express servindo um build falso ---
let dir;
let base;
let server;
before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'petspost-dist-'));
  mkdirSync(join(dir, 'posts'));
  mkdirSync(join(dir, 'sobre'));
  mkdirSync(join(dir, 'assets'));
  const page = (name) => `<html><head><title>${name}</title>${META_MARKER}</head><body>${name}</body></html>`;
  writeFileSync(join(dir, 'index.html'), page('home'));
  writeFileSync(join(dir, 'posts/detalhe.html'), page('detalhe'));
  writeFileSync(join(dir, 'sobre/index.html'), page('sobre'));
  writeFileSync(join(dir, 'assets/app-abc123.js'), 'console.log(1)');

  const posts = {
    get: async (id) => {
      if (id === 7) return post;
      throw new HttpError(404, 'NOT_FOUND', 'x'); // inexistente ou inativo
    },
  };
  const app = express().use(webRouter({ distDir: dir, posts, publicUrl: 'https://www.petspost.com.br', cache: false }));
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

test('ADR 002 /posts/:id público recebe Open Graph no HTML', async () => {
  const res = await fetch(`${base}/posts/7`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<meta property="og:title" content="Perdido: Rex/);
  assert.match(html, /<meta property="og:url" content="https:\/\/www\.petspost\.com\.br\/posts\/7"/);
  assert.equal(res.headers.get('cache-control'), 'no-cache');
});

test('PERM-002 /posts/:id inexistente ou inativo → 404 sem meta do post', async () => {
  const res = await fetch(`${base}/posts/8`);
  assert.equal(res.status, 404);
  const html = await res.text();
  assert.doesNotMatch(html, /og:title/);
  assert.match(html, /detalhe/); // a página do front mostra "não encontrado"
});

test('páginas, assets com cache longo, 404 e redirects das URLs antigas', async () => {
  assert.match(await (await fetch(`${base}/sobre`)).text(), /sobre/);
  const asset = await fetch(`${base}/assets/app-abc123.js`);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('cache-control'), /max-age=31536000.*immutable/);
  assert.equal((await fetch(`${base}/assets/nao-existe.js`)).status, 404);
  assert.equal((await fetch(`${base}/pagina-que-nao-existe`)).status, 404);
  const legacy = await fetch(`${base}/auth/login`, { redirect: 'manual' });
  assert.deepEqual([legacy.status, legacy.headers.get('location')], [301, '/login/']);
});
