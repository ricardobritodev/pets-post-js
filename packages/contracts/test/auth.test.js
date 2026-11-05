import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerSchema, loginSchema } from '../src/index.js';

const base = {
  name: '  Maria Silva ',
  email: ' Maria@Email.COM ',
  phone: '',
  password: 'segura123',
  confirmPassword: 'segura123',
};

test('BR-AUTH-001 cadastro válido normaliza nome, email e telefone vazio', () => {
  const r = registerSchema.parse(base);
  assert.equal(r.name, 'Maria Silva');
  assert.equal(r.email, 'maria@email.com');
  assert.equal(r.phone, null);
});

test('BR-AUTH-002 senha com menos de 8 caracteres é rejeitada', () => {
  const r = registerSchema.safeParse({ ...base, password: '1234567', confirmPassword: '1234567' });
  assert.equal(r.success, false);
});

test('BR-AUTH-003 confirmação diferente é rejeitada no campo confirmPassword', () => {
  const r = registerSchema.safeParse({ ...base, confirmPassword: 'outra123' });
  assert.equal(r.success, false);
  assert.deepEqual(r.error.issues[0].path, ['confirmPassword']);
});

test('BR-VAL-001 telefone precisa estar no formato com máscara', () => {
  assert.equal(registerSchema.safeParse({ ...base, phone: '(11) 99999-9999' }).success, true);
  assert.equal(registerSchema.safeParse({ ...base, phone: '(11) 3333-4444' }).success, true);
  assert.equal(registerSchema.safeParse({ ...base, phone: '11999999999' }).success, false);
});

test('BR-VAL-002 email inválido é rejeitado', () => {
  assert.equal(registerSchema.safeParse({ ...base, email: 'nao-e-email' }).success, false);
});

test('login: remember padrão é false', () => {
  assert.equal(loginSchema.parse({ email: 'a@b.com', password: 'x' }).remember, false);
});
