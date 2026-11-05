// Porta 1:1 de tests/test_utils.py do projeto Flask — BR-CONTACT-001
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toWhatsappUrl } from '../src/whatsapp.js';

const valid = [
  ['(11) 99999-9999', 'https://wa.me/5511999999999'],
  ['11999999999', 'https://wa.me/5511999999999'],
  ['+55 11 99999-9999', 'https://wa.me/5511999999999'],
  ['5511999999999', 'https://wa.me/5511999999999'],
  ['(11) 3333-4444', 'https://wa.me/551133334444'],
  ['11 9 8888-7777', 'https://wa.me/5511988887777'],
  ['55 11 9 8765-4321', 'https://wa.me/5511987654321'],
];

for (const [input, expected] of valid) {
  test(`BR-CONTACT-001 número válido: ${input}`, () => {
    assert.equal(toWhatsappUrl(input), expected);
  });
}

test('BR-CONTACT-001 sem mensagem não inclui ?text=', () => {
  assert.ok(!toWhatsappUrl('11999999999').includes('?text='));
});

test('BR-CONTACT-001 mensagem é codificada em UTF-8', () => {
  const url = toWhatsappUrl('11999999999', 'Olá!');
  assert.ok(url.includes('?text='));
  assert.ok(url.includes('Ol%C3%A1'));
});

test('BR-CONTACT-001 codificação idêntica ao urllib.parse.quote do Python', () => {
  // quote('Olá! *Pet perdido* 🐾 a/b') no Python 3
  assert.equal(
    toWhatsappUrl('11999999999', 'Olá! *Pet perdido* 🐾 a/b'),
    'https://wa.me/5511999999999?text=Ol%C3%A1%21%20%2APet%20perdido%2A%20%F0%9F%90%BE%20a/b',
  );
});

const invalid = ['0800 123 4567', '0300 123 456', '99999-9999', '', null, undefined, 'sem numero', '1234'];
for (const input of invalid) {
  test(`BR-CONTACT-001 inválido retorna null: ${JSON.stringify(input)}`, () => {
    assert.equal(toWhatsappUrl(input), null);
  });
}
