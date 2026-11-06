import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cepSchema } from '../src/index.js';

test('BR-GEO-004 CEP aceita 8 dígitos com ou sem máscara', () => {
  assert.equal(cepSchema.parse('01310-100'), '01310100');
  assert.equal(cepSchema.parse('01310100'), '01310100');
  assert.equal(cepSchema.parse(' 01.310-100 '), '01310100');
});

test('BR-GEO-004 CEP com outra quantidade de dígitos é rejeitado', () => {
  for (const bad of ['1234567', '123456789', '', 'abcdefgh']) {
    assert.equal(cepSchema.safeParse(bad).success, false, bad);
  }
});
