// Regras puras de posts — BR-PHOTO-002 e mensagem do WhatsApp (BR-CONTACT-001).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickPrimaryPhoto, postWhatsappMessage } from '../src/posts.js';
import { toWhatsappUrl } from '../src/whatsapp.js';

test('BR-PHOTO-002 usa a foto marcada como principal', () => {
  const photos = [{ id: 3 }, { id: 1 }, { id: 2, isPrimary: true }];
  assert.equal(pickPrimaryPhoto(photos).id, 2);
});

test('BR-PHOTO-002 sem foto marcada, usa a primeira enviada (menor id)', () => {
  assert.equal(pickPrimaryPhoto([{ id: 7 }, { id: 4 }, { id: 9 }]).id, 4);
});

test('BR-PHOTO-002 sem fotos → null', () => {
  assert.equal(pickPrimaryPhoto([]), null);
  assert.equal(pickPrimaryPhoto(undefined), null);
});

test('mensagem do WhatsApp usa o nome do pet ou o tipo', () => {
  assert.equal(
    postWhatsappMessage({ status: 'lost', petName: 'Rex', petType: 'dog' }),
    'Olá! Vi seu anúncio no Pets Post:\n*Perdido — Rex*\nGostaria de saber mais informações. 🐾',
  );
  assert.match(postWhatsappMessage({ status: 'found', petName: null, petType: 'cat' }), /\*Encontrado — Gato\*/);
});

test('BR-CONTACT-001 link do WhatsApp do post leva a mensagem codificada', () => {
  const url = toWhatsappUrl('(11) 98765-4321', postWhatsappMessage({ status: 'lost', petName: 'Rex', petType: 'dog' }));
  assert.match(url, /^https:\/\/wa\.me\/5511987654321\?text=Ol%C3%A1%21%20Vi%20seu%20an%C3%BAncio/);
  assert.match(url, /%0A%2APerdido%20%E2%80%94%20Rex%2A%0A/);
});
