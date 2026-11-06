import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adminUsersQuerySchema,
  adminListingsQuerySchema,
  visibilitySchema,
  partnerSchema,
  updatePartnerSchema,
} from '../src/index.js';

const partner = { name: 'Clínica Amigo Fiel', type: 'vet_clinic', address: 'Rua X, 10, São Paulo, SP' };

test('busca e filtros do admin: vazio some, inválido é ignorado', () => {
  assert.deepEqual(adminUsersQuerySchema.parse({ q: '  maria ', page: '2' }), { q: 'maria', page: 2 });
  assert.deepEqual(adminUsersQuerySchema.parse({ q: '   ' }), { q: undefined, page: 1 });
  const q = adminListingsQuerySchema.parse({ visibility: 'hidden', status: 'perdido' });
  assert.equal(q.visibility, 'hidden');
  assert.equal(q.status, undefined);
});

test('BR-ADMIN-003 visibilidade só aceita booleano de verdade', () => {
  assert.deepEqual(visibilitySchema.parse({ isActive: false }), { isActive: false });
  for (const bad of [{}, { isActive: 'false' }, { isActive: 0 }]) assert.equal(visibilitySchema.safeParse(bad).success, false);
});

test('BR-PARTNER-002 parceiro: obrigatórios, site só http/https, ativo por padrão', () => {
  const ok = partnerSchema.parse({ ...partner, website: 'https://amigofiel.com.br', phone: '', email: '' });
  assert.equal(ok.isActive, true);
  assert.equal(ok.phone, null);
  assert.equal(ok.website, 'https://amigofiel.com.br');
  assert.equal(ok.lat, undefined);
  for (const website of ['javascript:alert(1)', 'www.semprotocolo.com', 'ftp://x.com']) {
    const r = partnerSchema.safeParse({ ...partner, website });
    assert.equal(r.success, false, website);
    assert.match(r.error.issues[0].message, /http/);
  }
  const missing = partnerSchema.safeParse({});
  assert.deepEqual(missing.error.issues.map((i) => i.path[0]).sort(), ['address', 'name', 'type']);
});

test('BR-PARTNER-002 coordenadas manuais vão juntas e dentro do mapa', () => {
  assert.deepEqual(partnerSchema.parse({ ...partner, lat: '-23.5', lng: '-46.6' }).lat, -23.5);
  assert.equal(partnerSchema.parse({ ...partner, lat: '', lng: '' }).lat, undefined);
  assert.equal(partnerSchema.safeParse({ ...partner, lat: '-23.5' }).success, false);
  assert.equal(partnerSchema.safeParse({ ...partner, lat: '95', lng: '0' }).success, false);
});

test('PATCH de parceiro: subconjunto, vazio → erro, isActive ausente não muda', () => {
  assert.deepEqual(updatePartnerSchema.parse({ name: 'Novo' }), { name: 'Novo' });
  assert.equal(updatePartnerSchema.parse({ isActive: false }).isActive, false);
  assert.equal(updatePartnerSchema.safeParse({}).success, false);
});
