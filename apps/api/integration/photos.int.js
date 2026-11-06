// Integração: fotos dos posts contra MySQL real — specs/api/posts.md (BR-PHOTO-001..007)
import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { prisma } from '@petspost/db';
import { clearDatabase } from '@petspost/db/testing';
import { hashPassword } from '@petspost/domain';
import { createDiskStorage } from '../src/lib/storage.js';
import { startApp, createClient, LOOSE_LIMITS } from './helpers.js';

let app;
let dir;
let hash;
let maria;
let carlos;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'petspost-uploads-'));
  app = await startApp({ db: prisma, limits: LOOSE_LIMITS, storage: createDiskStorage({ dir }) });
  hash = await hashPassword('Senha@123');
});
after(async () => {
  await app?.close(); // com --test-name-pattern o before pode nem rodar
  await prisma.$disconnect();
  if (dir) await rm(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  await clearDatabase(prisma);
  for (const f of await readdir(dir)) await rm(join(dir, f));
  const mk = (name, email) => prisma.user.create({ data: { name, email, passwordHash: hash } });
  [maria, carlos] = await Promise.all([mk('Maria Silva', 'maria@exemplo.com'), mk('Carlos', 'carlos@exemplo.com')]);
});

const mkPost = (over = {}) =>
  prisma.petPost.create({
    data: {
      title: 'Gata perdida',
      description: 'Sumiu ontem.',
      status: 'lost',
      petType: 'cat',
      lastSeenLocation: 'Centro, Curitiba, PR',
      contactPhone: '(41) 98765-4321',
      userId: maria.id,
      ...over,
    },
  });

/** Foto "antiga" direto no banco (sem arquivo), para testar contagem e principal. */
const mkPhoto = (postId, i, isPrimary = false) =>
  prisma.photo.create({ data: { postId, filename: `antiga${i}.jpg`, url: `/uploads/antiga${i}.jpg`, isPrimary } });

const png = (w = 1200, h = 900) => sharp({ create: { width: w, height: h, channels: 3, background: '#cc8844' } }).png().toBuffer();

/** Monta o multipart como o navegador faria. */
async function formWith(files) {
  const form = new FormData();
  for (const { name, data, type = 'image/png' } of files) form.append('photos', new Blob([data], { type }), name);
  return form;
}

const as = (email) => createClient(app.base).loginAs(email);
const exists = (name) => access(join(dir, name)).then(() => true, () => false);
const fileOf = (url) => url.split('/').pop();

describe('POST /posts/:id/photos', () => {
  test('BR-PHOTO-002 a primeira foto enviada vira a principal; arquivos vão para o disco em JPEG', async () => {
    const post = await mkPost();
    const maria = await as('maria@exemplo.com');
    const res = await maria.upload(`/posts/${post.id}/photos`, await formWith([
      { name: 'um.png', data: await png() },
      { name: 'dois.png', data: await png(400, 300) },
    ]));
    assert.equal(res.status, 201);
    assert.deepEqual(res.body.rejected, []);
    const { photos, primaryPhoto } = res.body.post;
    assert.equal(photos.length, 2);
    assert.deepEqual(photos.map((p) => p.isPrimary), [true, false]);
    assert.equal(primaryPhoto.url, photos[0].url);
    for (const p of photos) {
      assert.match(p.url, /^\/uploads\/[0-9a-f]{32}\.jpg$/); // BR-PHOTO-005
      assert.ok(await exists(fileOf(p.url)));
    }
    const meta = await sharp(join(dir, fileOf(photos[0].url))).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.equal(meta.width, 800); // BR-PHOTO-004
  });

  test('BR-PHOTO-001 passando de 6, as excedentes são recusadas com aviso', async () => {
    const post = await mkPost();
    for (let i = 0; i < 5; i++) await mkPhoto(post.id, i, i === 0);
    const maria = await as('maria@exemplo.com');
    const res = await maria.upload(`/posts/${post.id}/photos`, await formWith([
      { name: 'a.png', data: await png(100, 100) },
      { name: 'b.png', data: await png(100, 100) },
      { name: 'c.png', data: await png(100, 100) },
    ]));
    assert.equal(res.status, 201);
    assert.equal(res.body.post.photos.length, 6);
    assert.deepEqual(res.body.rejected.map((r) => r.name), ['b.png', 'c.png']);
    assert.match(res.body.rejected[0].message, /Limite de 6 fotos/);
    assert.equal(res.body.post.photos.filter((p) => p.isPrimary).length, 1); // a principal continua a antiga
  });

  test('BR-PHOTO-006 foto ruim é recusada e as outras são salvas', async () => {
    const post = await mkPost();
    const maria = await as('maria@exemplo.com');
    const res = await maria.upload(`/posts/${post.id}/photos`, await formWith([
      { name: 'falsa.jpg', data: Buffer.from('não sou imagem'), type: 'image/jpeg' },
      { name: 'boa.png', data: await png(200, 200) },
      { name: 'doc.pdf', data: Buffer.from('%PDF-1.4'), type: 'application/pdf' },
    ]));
    assert.equal(res.status, 201);
    assert.equal(res.body.post.photos.length, 1);
    assert.equal(res.body.post.photos[0].isPrimary, true); // a 1ª *salva* é a principal
    assert.deepEqual(res.body.rejected, [
      { name: 'falsa.jpg', message: 'Arquivo não é uma imagem válida.' },
      { name: 'doc.pdf', message: 'Formato não aceito. Use PNG, JPG, GIF ou WEBP.' },
    ]);
    assert.equal((await readdir(dir)).length, 1);
  });

  test('BR-PHOTO-006 todas recusadas → 200 e nada salvo', async () => {
    const post = await mkPost();
    const maria = await as('maria@exemplo.com');
    const res = await maria.upload(`/posts/${post.id}/photos`, await formWith([{ name: 'x.gif', data: Buffer.from('GIF89a lixo') }]));
    assert.equal(res.status, 200);
    assert.equal(res.body.post.photos.length, 0);
    assert.equal(res.body.rejected.length, 1);
  });

  test('BR-PHOTO-003 mais de 8 MB → 413 PAYLOAD_TOO_LARGE', async () => {
    const post = await mkPost();
    const maria = await as('maria@exemplo.com');
    const res = await maria.upload(`/posts/${post.id}/photos`, await formWith([
      { name: 'enorme.png', data: Buffer.alloc(8 * 1024 * 1024 + 10, 1) },
    ]));
    assert.equal(res.status, 413);
    assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
    assert.deepEqual(await readdir(dir), []);
  });

  test('sem arquivo ou sem multipart → 400', async () => {
    const post = await mkPost();
    const maria = await as('maria@exemplo.com');
    const empty = await maria.upload(`/posts/${post.id}/photos`, new FormData());
    assert.equal(empty.status, 400);
    const json = await maria.post(`/posts/${post.id}/photos`, { photos: [] });
    assert.equal(json.status, 400);
    assert.equal(json.body.error.code, 'VALIDATION_ERROR');
    const wrongField = new FormData();
    wrongField.append('foto', new Blob([await png(50, 50)]), 'a.png');
    assert.equal((await maria.upload(`/posts/${post.id}/photos`, wrongField)).status, 400);
  });

  test('PERM-001/002 visitante 401, outra pessoa 403, inativo de outra 404, sem CSRF 403', async () => {
    const post = await mkPost();
    const hidden = await mkPost({ isActive: false });
    const form = async () => formWith([{ name: 'a.png', data: await png(50, 50) }]);

    const anon = await createClient(app.base).init();
    assert.equal((await anon.upload(`/posts/${post.id}/photos`, await form())).status, 401);

    const carlos = await as('carlos@exemplo.com');
    const forbidden = await carlos.upload(`/posts/${post.id}/photos`, await form());
    assert.equal(forbidden.status, 403);
    assert.equal((await carlos.upload(`/posts/${hidden.id}/photos`, await form())).status, 404);
    assert.equal((await carlos.upload('/posts/999999/photos', await form())).status, 404);

    const maria = await as('maria@exemplo.com');
    const noCsrf = await maria.upload(`/posts/${post.id}/photos`, await form(), { csrf: false });
    assert.equal(noCsrf.status, 403);
    assert.equal(noCsrf.body.error.code, 'CSRF_INVALID');

    assert.deepEqual(await readdir(dir), []);
  });
});

describe('DELETE /posts/:id/photos/:photoId', () => {
  test('BR-PHOTO-002/007 remover a principal promove a próxima e apaga o arquivo', async () => {
    const post = await mkPost();
    const maria = await as('maria@exemplo.com');
    const up = await maria.upload(`/posts/${post.id}/photos`, await formWith([
      { name: 'a.png', data: await png(60, 60) },
      { name: 'b.png', data: await png(60, 60) },
    ]));
    const [first, second] = up.body.post.photos;

    const res = await maria.del(`/posts/${post.id}/photos/${first.id}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.post.photos, [{ ...second, isPrimary: true }]);
    assert.equal(await exists(fileOf(first.url)), false);
    assert.equal(await exists(fileOf(second.url)), true);
  });

  test('foto de outro post ou inexistente → 404; outra pessoa → 403', async () => {
    const a = await mkPost();
    const b = await mkPost();
    const photoOfB = await mkPhoto(b.id, 1, true);
    const maria = await as('maria@exemplo.com');
    assert.equal((await maria.del(`/posts/${a.id}/photos/${photoOfB.id}`)).status, 404);
    assert.equal((await maria.del(`/posts/${a.id}/photos/abc`)).status, 404);
    const carlos = await as('carlos@exemplo.com');
    assert.equal((await carlos.del(`/posts/${b.id}/photos/${photoOfB.id}`)).status, 403);
    assert.equal(await prisma.photo.count(), 1);
  });
});

describe('arquivos e exclusão do post', () => {
  test('BR-PHOTO-007 excluir o post apaga os arquivos das fotos', async () => {
    const post = await mkPost();
    const maria = await as('maria@exemplo.com');
    await maria.upload(`/posts/${post.id}/photos`, await formWith([
      { name: 'a.png', data: await png(60, 60) },
      { name: 'b.png', data: await png(60, 60) },
    ]));
    assert.equal((await readdir(dir)).length, 2);
    assert.equal((await maria.del(`/posts/${post.id}`)).status, 204);
    assert.deepEqual(await readdir(dir), []);
    assert.equal(await prisma.photo.count(), 0);
  });

  test('/uploads serve a foto com cache longo; /static/uploads (Flask) também; inexistente → 404', async () => {
    await writeFile(join(dir, 'abc123.jpg'), await sharp(await png(10, 10)).jpeg().toBuffer());
    for (const path of ['/uploads/abc123.jpg', '/static/uploads/abc123.jpg']) {
      const res = await fetch(`${app.base}${path}`);
      assert.equal(res.status, 200, path);
      assert.equal(res.headers.get('content-type'), 'image/jpeg');
      assert.match(res.headers.get('cache-control'), /max-age=31536000.*immutable/);
    }
    assert.equal((await fetch(`${app.base}/uploads/nao-existe.jpg`)).status, 404);
    assert.equal((await fetch(`${app.base}/uploads/../package.json`)).status, 404);
    assert.equal((await fetch(`${app.base}/uploads/.env`)).status, 404);
  });
});

test('limite de envios de fotos por IP (padrão 20/min, 200/h) → 429', async () => {
  const { DEFAULT_LIMITS } = await import('../src/middleware/rate-limit.js');
  assert.deepEqual(DEFAULT_LIMITS.upload, { perMinute: 20, perHour: 200 });

  const strict = await startApp({ db: prisma, limits: { ...LOOSE_LIMITS, upload: { perMinute: 1, perHour: 10 } }, storage: createDiskStorage({ dir }) });
  try {
    const post = await mkPost();
    const maria = await createClient(strict.base).loginAs('maria@exemplo.com');
    const send = async () => maria.upload(`/posts/${post.id}/photos`, await formWith([{ name: 'a.png', data: await png(30, 30) }]));
    assert.equal((await send()).status, 201);
    const blocked = await send();
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error.code, 'RATE_LIMITED');
  } finally {
    await strict.close();
  }
});
