import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdoptionSchema, updateAdoptionSchema, listAdoptionQuerySchema, partnersQuerySchema } from '../src/index.js';

const valid = {
  title: 'Gatinha para adoção',
  description: 'Muito carinhosa.',
  petType: 'cat',
  location: 'Pinheiros, São Paulo, SP',
  contactPhone: '(11) 98765-4321',
};

test('BR-ADOPT-001 campos obrigatórios e castrado/vacinado false por padrão', () => {
  const ok = createAdoptionSchema.parse(valid);
  assert.equal(ok.isNeutered, false);
  assert.equal(ok.isVaccinated, false);
  assert.equal(ok.petName, null);
  const bad = createAdoptionSchema.safeParse({ petType: 'peixe' });
  assert.equal(bad.success, false);
  const paths = bad.error.issues.map((i) => i.path[0]).sort();
  assert.deepEqual(paths, ['contactPhone', 'description', 'location', 'petType', 'title']);
});

test('BR-ADOPT-004 checkbox "on" vira true; requisitos até 2000 caracteres', () => {
  const ok = createAdoptionSchema.parse({ ...valid, isNeutered: 'on', isVaccinated: true, adopterRequirements: '  Casa com tela  ' });
  assert.equal(ok.isNeutered, true);
  assert.equal(ok.isVaccinated, true);
  assert.equal(ok.adopterRequirements, 'Casa com tela');
  assert.equal(createAdoptionSchema.safeParse({ ...valid, adopterRequirements: 'x'.repeat(2001) }).success, false);
});

test('PATCH de adoção: campo ausente não volta para false; vazio → 400', () => {
  assert.deepEqual(updateAdoptionSchema.parse({ title: 'Novo' }), { title: 'Novo' });
  assert.deepEqual(updateAdoptionSchema.parse({ isVaccinated: false }), { isVaccinated: false });
  assert.equal(updateAdoptionSchema.safeParse({}).success, false);
});

test('BR-ADOPT-002 filtro por tipo: inválido é ignorado, pet_type antigo aceito', () => {
  assert.deepEqual(listAdoptionQuerySchema.parse({ pet_type: 'dog' }), { page: 1, petType: 'dog' });
  assert.deepEqual(listAdoptionQuerySchema.parse({ petType: 'peixe', page: 'x' }), { page: 1, petType: undefined });
});

test('BR-PARTNER-003 query do mapa: lat/lng juntos, raio de 1 a 100', () => {
  assert.deepEqual(partnersQuerySchema.parse({}), { radiusKm: 10 });
  assert.deepEqual(partnersQuerySchema.parse({ type: 'vet_clinic', lat: '-23.5', lng: '-46.6', radiusKm: '5' }),
    { type: 'vet_clinic', lat: -23.5, lng: -46.6, radiusKm: 5 });
  assert.equal(partnersQuerySchema.parse({ type: 'hospital' }).type, undefined);
  for (const bad of [{ lat: '-23' }, { lng: '-46' }, { lat: '91', lng: '0' }, { lat: '0', lng: '181' }, { lat: 'abc', lng: '0' }, { lat: '0', lng: '0', radiusKm: '500' }, { lat: '0', lng: '0', radiusKm: '0' }]) {
    assert.equal(partnersQuerySchema.safeParse(bad).success, false, JSON.stringify(bad));
  }
});
