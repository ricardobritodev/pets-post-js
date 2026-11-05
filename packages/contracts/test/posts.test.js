import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPostSchema, updatePostSchema, listPostsQuerySchema, idParamSchema } from '../src/index.js';

const valid = {
  title: '  Cachorro caramelo perdido ',
  description: 'Fugiu no parque.',
  status: 'lost',
  petType: 'dog',
  lastSeenLocation: 'Parque Ibirapuera, São Paulo, SP',
  contactPhone: '(11) 98765-4321',
};

const errors = (r) => r.error.issues.map((i) => [i.path.join('.'), i.message]);

test('BR-POST-001 post válido: trim e opcionais vazios viram null', () => {
  const r = createPostSchema.parse({ ...valid, petName: '', petSize: '', contactEmail: '', reward: '  ' });
  assert.equal(r.title, 'Cachorro caramelo perdido');
  assert.deepEqual([r.petName, r.petSize, r.contactEmail, r.reward], [null, null, null, null]);
});

test('BR-POST-001 campos obrigatórios com as mensagens do formulário antigo', () => {
  const r = createPostSchema.safeParse({ status: 'lost' });
  const paths = errors(r).map(([p]) => p);
  for (const f of ['title', 'description', 'petType', 'lastSeenLocation', 'contactPhone']) assert.ok(paths.includes(f), f);
  const r2 = createPostSchema.safeParse({ ...valid, title: '', lastSeenLocation: ' ', contactPhone: '' });
  assert.deepEqual(errors(r2), [
    ['title', 'O título é obrigatório.'],
    ['lastSeenLocation', 'A localização é obrigatória.'],
    ['contactPhone', 'O telefone de contato é obrigatório.'],
  ]);
});

test('BR-POST-001 limites: título 150 e localização 255', () => {
  assert.equal(createPostSchema.safeParse({ ...valid, title: 'x'.repeat(151) }).success, false);
  assert.equal(createPostSchema.safeParse({ ...valid, title: 'x'.repeat(150) }).success, true);
  assert.equal(createPostSchema.safeParse({ ...valid, lastSeenLocation: 'x'.repeat(256) }).success, false);
});

test('BR-VAL-001/002 telefone e email de contato validados', () => {
  assert.equal(createPostSchema.safeParse({ ...valid, contactPhone: '11987654321' }).success, false);
  assert.equal(createPostSchema.safeParse({ ...valid, contactEmail: 'nao-e-email' }).success, false);
  assert.equal(createPostSchema.parse({ ...valid, contactEmail: ' A@B.COM ' }).contactEmail, 'a@b.com');
});

test('enums inválidos no corpo são rejeitados', () => {
  assert.equal(createPostSchema.safeParse({ ...valid, status: 'perdido' }).success, false);
  assert.equal(createPostSchema.safeParse({ ...valid, petType: 'peixe' }).success, false);
  assert.equal(createPostSchema.safeParse({ ...valid, petSize: 'gigante' }).success, false);
});

test('campos que não são do post são descartados (ex.: userId, isActive)', () => {
  const r = createPostSchema.parse({ ...valid, userId: 99, isActive: false, isResolved: true });
  assert.equal('userId' in r || 'isActive' in r || 'isResolved' in r, false);
});

test('updatePostSchema aceita parcial com as mesmas regras e recusa vazio', () => {
  assert.deepEqual(updatePostSchema.parse({ title: ' Novo ' }), { title: 'Novo' });
  assert.equal(updatePostSchema.safeParse({ title: '' }).success, false);
  assert.equal(updatePostSchema.safeParse({}).success, false);
});

test('BR-POST-003 filtros inválidos são ignorados e page inválida vira 1', () => {
  assert.deepEqual(listPostsQuerySchema.parse({ status: 'xyz', petType: 'peixe', page: 'abc' }), {
    status: undefined,
    petType: undefined,
    page: 1,
  });
  assert.deepEqual(listPostsQuerySchema.parse({ status: 'found', petType: 'cat', page: '3' }), {
    status: 'found',
    petType: 'cat',
    page: 3,
  });
  assert.equal(listPostsQuerySchema.parse({}).page, 1);
});

test('BR-POST-003 aceita pet_type dos links antigos', () => {
  assert.equal(listPostsQuerySchema.parse({ pet_type: 'bird' }).petType, 'bird');
});

test('idParamSchema: só inteiro positivo', () => {
  assert.equal(idParamSchema.parse('12'), 12);
  for (const v of ['0', '-1', '1.5', 'abc', '99999999999']) assert.equal(idParamSchema.parse(v), null, v);
});
