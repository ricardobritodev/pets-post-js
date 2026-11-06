/**
 * Ícones SVG (substituem os emojis da interface).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ICONS, iconSvg } from '../src/lib/icon-data.js';

const root = new URL('..', import.meta.url).pathname;

test('todo ícone tem só path/circle com atributos de desenho', () => {
  for (const [name, shapes] of Object.entries(ICONS)) {
    assert.ok(shapes.length > 0, name);
    for (const [tag, attrs] of shapes) {
      assert.ok(['path', 'circle'].includes(tag), `${name}: ${tag}`);
      for (const k of Object.keys(attrs)) assert.ok(['d', 'cx', 'cy', 'r'].includes(k), `${name}: ${k}`);
    }
  }
});

test('iconSvg: decorativo por padrão, com nome quando tem label, e escapa atributos', () => {
  const svg = iconSvg('paw', { size: 48, className: 'mx-auto' });
  assert.match(svg, /^<svg [^>]*width="48" height="48"/);
  assert.match(svg, /class="icon mx-auto"/);
  assert.match(svg, /aria-hidden="true"/);
  const labeled = iconSvg('paw', { label: 'Pata "x" <b>' });
  assert.match(labeled, /role="img" aria-label="Pata &quot;x&quot; &lt;b>"/);
  assert.doesNotMatch(labeled, /aria-hidden/);
  assert.throws(() => iconSvg('nao-existe'), /ícone desconhecido/);
});

/** Arquivos da interface (HTML e JS de src/), sem dependências nem build. */
function uiFiles(dir = root) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (['node_modules', 'dist', 'test', 'public'].includes(name)) return [];
    if (statSync(full).isDirectory()) return uiFiles(full);
    return /\.(html|js|css)$/.test(name) && !name.endsWith('.config.js') && name !== 'page-routes.js' ? [full] : [];
  });
}

test('a interface não usa emoji (usa os ícones SVG)', () => {
  const emoji = /(?![©®™])\p{Extended_Pictographic}/u; // ©, ® e ™ são texto, não emoji
  for (const file of uiFiles()) {
    const text = readFileSync(file, 'utf8');
    const line = text.split('\n').findIndex((l) => emoji.test(l));
    assert.equal(line, -1, `${relative(root, file)}:${line + 1} tem emoji`);
  }
});

test('todo <i data-icon> do HTML aponta para um ícone que existe', () => {
  for (const file of uiFiles().filter((f) => f.endsWith('.html'))) {
    for (const [, name] of readFileSync(file, 'utf8').matchAll(/data-icon="([^"]+)"/g)) {
      assert.ok(ICONS[name], `${relative(root, file)}: ${name}`);
    }
  }
});
