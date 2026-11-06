/**
 * Funções puras do front (rodam no Node, sem navegador).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskCep, formatAddress } from '../src/lib/cep-lookup.js';
import { checkFile, MAX_FILE_BYTES } from '../src/lib/photo-picker.js';

test('BR-GEO-004 máscara de CEP 00000-000', () => {
  assert.equal(maskCep('01310100'), '01310-100');
  assert.equal(maskCep('0131'), '0131');
  assert.equal(maskCep('01310'), '01310');
  assert.equal(maskCep('013101'), '01310-1');
  assert.equal(maskCep('01.310-100999'), '01310-100');
});

test('BR-GEO-004 endereço montado como no sistema antigo: rua, bairro, cidade/UF', () => {
  assert.equal(formatAddress({ street: 'Avenida Paulista', neighborhood: 'Bela Vista', city: 'São Paulo', uf: 'SP' }),
    'Avenida Paulista, Bela Vista, São Paulo/SP');
  // CEP geral de cidade pequena: sem rua nem bairro
  assert.equal(formatAddress({ street: '', neighborhood: '', city: 'Itu', uf: 'SP' }), 'Itu/SP');
  assert.equal(formatAddress({ street: 'Rua X', neighborhood: '', city: 'Itu', uf: '' }), 'Rua X, Itu');
  assert.ok(formatAddress({ street: 'a'.repeat(300), neighborhood: '', city: '', uf: '' }).length <= 255);
});

test('BR-PHOTO-003 o navegador avisa cedo sobre formato e tamanho', () => {
  const file = (name, size = 1000) => ({ name, size });
  assert.equal(checkFile(file('gato.JPG')), null);
  assert.equal(checkFile(file('gato.webp')), null);
  assert.match(checkFile(file('gato.pdf')), /formato/);
  assert.match(checkFile(file('semextensao')), /formato/);
  assert.match(checkFile(file('grande.png', MAX_FILE_BYTES + 1)), /8 MB/);
  assert.ok(MAX_FILE_BYTES < 8 * 1024 * 1024); // folga para o cabeçalho do multipart
});
