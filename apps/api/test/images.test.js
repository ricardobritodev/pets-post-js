/**
 * Processamento de imagens e storage — BR-PHOTO-003/004/005/007.
 * As imagens "fixture" são geradas aqui mesmo com o sharp, para não guardar binários no repo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { processImage, isAllowedName, newPhotoName, ImageError, MESSAGES } from '../src/lib/images.js';
import { createDiskStorage, assertSafeName } from '../src/lib/storage.js';

const solid = (width, height, { channels = 3, background = '#3366cc' } = {}) =>
  sharp({ create: { width, height, channels, background } });

test('BR-PHOTO-003 extensões aceitas pelo nome do arquivo', () => {
  for (const ok of ['a.png', 'b.JPG', 'c.jpeg', 'd.gif', 'e.webp', 'foto.de.gato.Png']) assert.ok(isAllowedName(ok), ok);
  for (const bad of ['a.pdf', 'b.svg', 'semextensao', 'c.jpg.exe', '', undefined, '.png.']) assert.ok(!isAllowedName(bad), String(bad));
});

test('BR-PHOTO-004 PNG grande com transparência vira JPEG RGB de 800 px', async () => {
  const input = await solid(1600, 1200, { channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const out = await processImage(input);
  const meta = await sharp(out).metadata();
  assert.equal(meta.format, 'jpeg');
  assert.equal(meta.width, 800);
  assert.equal(meta.height, 600);
  assert.equal(meta.channels, 3);
  assert.equal(meta.hasAlpha, false);
  // transparência vira branco
  const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] > 240 && data[1] > 240 && data[2] > 240);
});

test('BR-PHOTO-004 imagem pequena não é ampliada', async () => {
  const out = await processImage(await solid(300, 200).jpeg().toBuffer());
  const meta = await sharp(out).metadata();
  assert.equal(meta.width, 300);
  assert.equal(meta.height, 200);
});

test('BR-PHOTO-004 GIF e WEBP são aceitos e viram JPEG', async () => {
  for (const fmt of ['gif', 'webp']) {
    const out = await processImage(await solid(100, 80)[fmt]().toBuffer());
    assert.equal((await sharp(out).metadata()).format, 'jpeg', fmt);
  }
});

test('BR-PHOTO-004 GIF animado vira só o primeiro quadro', async () => {
  const frame = await solid(40, 30, { channels: 4, background: '#ff0000' }).raw().toBuffer();
  const frame2 = await solid(40, 30, { channels: 4, background: '#00ff00' }).raw().toBuffer();
  const gif = await sharp(Buffer.concat([frame, frame2]), { raw: { width: 40, height: 60, channels: 4, pageHeight: 30 } })
    .gif()
    .toBuffer();
  assert.equal((await sharp(gif).metadata()).pages, 2);
  const out = await processImage(gif);
  const meta = await sharp(out).metadata();
  assert.equal(meta.height, 30);
  assert.equal(meta.pages, undefined);
});

test('BR-PHOTO-004 arquivo de texto com nome .jpg é rejeitado (o conteúdo manda)', async () => {
  await assert.rejects(processImage(Buffer.from('isto não é uma imagem, só finge ser .jpg')), (err) =>
    err instanceof ImageError && err.message === MESSAGES.notImage);
});

test('BR-PHOTO-004 imagem truncada é rejeitada', async () => {
  const png = await solid(200, 200).png().toBuffer();
  await assert.rejects(processImage(png.subarray(0, png.length / 2)), ImageError);
});

test('BR-PHOTO-004 SVG é rejeitado mesmo sendo imagem', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
  await assert.rejects(processImage(svg), (err) => err instanceof ImageError && err.message === MESSAGES.notImage);
});

test('BR-PHOTO-004 "decompression bomb" acima de 20 MP é rejeitada', async () => {
  // 5000×5000 = 25 MP, mas o PNG de cor sólida tem poucos KB.
  const bomb = await solid(5000, 5000, { background: '#000000' }).png({ compressionLevel: 9 }).toBuffer();
  assert.ok(bomb.length < 200_000, `fixture pequena (${bomb.length} bytes)`);
  await assert.rejects(processImage(bomb), (err) => err instanceof ImageError && err.message === MESSAGES.tooManyPixels);
});

test('BR-PHOTO-004 rotação do EXIF é aplicada e os metadados (GPS) somem', async () => {
  const input = await solid(400, 200)
    .jpeg()
    .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: 'dono', Artist: 'alguem' } } })
    .toBuffer();
  const before = await sharp(input).metadata();
  assert.equal(before.orientation, 6);
  assert.ok(before.exif);

  const out = await processImage(input);
  const meta = await sharp(out).metadata();
  assert.equal(meta.exif, undefined);
  assert.equal(meta.orientation, undefined);
  assert.equal(meta.width, 200); // girou 90°
  assert.equal(meta.height, 400);
});

test('BR-PHOTO-005 nome novo é um UUID .jpg, sem relação com o enviado', () => {
  const a = newPhotoName();
  assert.match(a, /^[0-9a-f]{32}\.jpg$/);
  assert.notEqual(a, newPhotoName());
});

test('BR-PHOTO-007 storage em disco salva, monta a URL e remove', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'petspost-storage-'));
  try {
    const storage = createDiskStorage({ dir: join(dir, 'uploads') });
    const name = newPhotoName();
    await storage.save(name, Buffer.from('x'));
    assert.equal((await readFile(join(dir, 'uploads', name))).toString(), 'x');
    assert.equal(storage.urlFor(name), `/uploads/${name}`);
    await assert.rejects(storage.save(name, Buffer.from('y')), /EEXIST/); // nunca sobrescreve
    await storage.remove(name);
    await storage.remove(name); // não existir não é erro
    assert.deepEqual(await readdir(join(dir, 'uploads')), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('BR-PHOTO-007 storage recusa nomes com caminho', () => {
  for (const bad of ['../x.jpg', 'a/b.jpg', '..', '.hidden', 'a\\b.jpg', '', null]) {
    assert.throws(() => assertSafeName(bad), /inválido/, String(bad));
  }
  assert.equal(assertSafeName('a3f8b2c1d4.jpg'), 'a3f8b2c1d4.jpg');
});
