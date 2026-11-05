// BR-AUTH-009 — redirect pós-login só para o mesmo site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeRedirectPath } from '../src/redirect.js';

test('BR-AUTH-009 aceita caminhos relativos do mesmo site', () => {
  assert.equal(safeRedirectPath('/'), '/');
  assert.equal(safeRedirectPath('/posts/12'), '/posts/12');
  assert.equal(safeRedirectPath('/posts/?status=lost#lista'), '/posts/?status=lost#lista');
  assert.equal(safeRedirectPath('/adocao/novo'), '/adocao/novo');
});

test('BR-AUTH-009 recusa open redirect e cai no fallback', () => {
  const ataques = [
    'https://mal.com',
    'http://mal.com/posts',
    '//mal.com',
    '///mal.com',
    '/\\mal.com',
    '\\\\mal.com',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,oi',
    'posts/12',
    '/\tmal.com',
    '/\nmal.com',
    '',
    null,
    undefined,
    42,
    ['/'],
    '/' + 'a'.repeat(3000),
  ];
  for (const next of ataques) assert.equal(safeRedirectPath(next), '/', `aceitou: ${JSON.stringify(next)}`);
});

test('BR-AUTH-009 não volta para as páginas de login/cadastro', () => {
  assert.equal(safeRedirectPath('/login/'), '/');
  assert.equal(safeRedirectPath('/cadastro'), '/');
  assert.equal(safeRedirectPath('/login-ajuda'), '/login-ajuda');
});

test('BR-AUTH-009 fallback configurável', () => {
  assert.equal(safeRedirectPath('//mal.com', '/minha-conta'), '/minha-conta');
});
