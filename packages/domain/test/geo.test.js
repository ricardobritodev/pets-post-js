import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, boundingBox, safeWebsite, adoptionWhatsappMessage, PARTNER_WHATSAPP_MESSAGE } from '../src/index.js';

const SE = { lat: -23.5505, lng: -46.6333 }; // Praça da Sé
const PAULISTA = { lat: -23.5614, lng: -46.6559 }; // MASP
const RIO = { lat: -22.9068, lng: -43.1729 };

test('BR-PARTNER-003 Haversine: distâncias conhecidas', () => {
  assert.equal(haversineKm(SE, SE), 0);
  const sePaulista = haversineKm(SE, PAULISTA);
  assert.ok(sePaulista > 2.5 && sePaulista < 2.8, `Sé–MASP ≈ 2,6 km (deu ${sePaulista})`);
  const spRio = haversineKm(SE, RIO);
  assert.ok(spRio > 355 && spRio < 365, `SP–Rio ≈ 360 km em linha reta (deu ${spRio})`);
  assert.equal(Math.round(haversineKm(SE, RIO)), Math.round(haversineKm(RIO, SE))); // simétrica
});

test('BR-PARTNER-003 bounding box contém tudo que está dentro do raio', () => {
  const box = boundingBox(SE, 10);
  for (let i = 0; i < 360; i += 15) {
    // ponto a ~9,9 km em várias direções
    const lat = SE.lat + (9.9 / 111.32) * Math.cos((i * Math.PI) / 180);
    const lng = SE.lng + (9.9 / (111.32 * Math.cos((SE.lat * Math.PI) / 180))) * Math.sin((i * Math.PI) / 180);
    assert.ok(lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng, `ângulo ${i}`);
  }
  const pole = boundingBox({ lat: 89.99, lng: 0 }, 50);
  assert.ok(pole.maxLat <= 90 && pole.minLng >= -180 && pole.maxLng <= 180);
});

test('BR-PARTNER-002 site só http/https', () => {
  assert.equal(safeWebsite('https://exemplo.com.br'), 'https://exemplo.com.br/');
  assert.equal(safeWebsite(' http://vet.com/a?b=1 '), 'http://vet.com/a?b=1');
  for (const bad of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', 'ftp://x.com', 'www.semprotocolo.com', '', null, 42]) {
    assert.equal(safeWebsite(bad), null, String(bad));
  }
});

test('mensagens do WhatsApp de adoção e parceiros', () => {
  assert.equal(adoptionWhatsappMessage({ petName: 'Mel', petType: 'cat' }), 'Olá! Vi no Pets Post que *Mel* está para adoção.\nGostaria de saber mais. 🐾');
  assert.match(adoptionWhatsappMessage({ petName: null, petType: 'dog' }), /\*Cachorro\*/);
  assert.match(PARTNER_WHATSAPP_MESSAGE, /mapa do Pets Post/);
});
