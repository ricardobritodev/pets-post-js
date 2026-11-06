/**
 * images.js — Re-codifica as fotos enviadas (BR-PHOTO-003/004/005).
 *
 * Porta do app/utils/upload.py do Flask (Pillow), agora com sharp:
 *   - o conteúdo decide se é imagem, não a extensão (um .jpg falso é rejeitado);
 *   - acima de 20 MP é rejeitado antes de decodificar (decompression bomb);
 *   - aplica a rotação do EXIF e depois descarta todos os metadados (o EXIF pode ter GPS);
 *   - RGB com fundo branco, no máx. 800 px de largura, JPEG qualidade 85.
 * O buffer original nunca é salvo.
 */
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { PHOTO_POLICY } from '@petspost/domain';

/** Erro de uma foto específica: vira um item de `rejected`, não derruba a requisição (BR-PHOTO-006). */
export class ImageError extends Error {}

/** Formatos que o sharp pode reportar e que aceitamos. SVG, TIFF, HEIF etc. ficam de fora. */
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'gif', 'webp']);

export const MESSAGES = Object.freeze({
  extension: 'Formato não aceito. Use PNG, JPG, GIF ou WEBP.',
  notImage: 'Arquivo não é uma imagem válida.',
  tooManyPixels: `Imagem muito grande (máx. ${PHOTO_POLICY.maxPixels / 1_000_000} MP).`,
});

/** BR-PHOTO-003 — extensão do nome enviado está na lista? */
export function isAllowedName(name) {
  const ext = String(name ?? '').split('.').pop()?.toLowerCase();
  return String(name ?? '').includes('.') && PHOTO_POLICY.allowedExtensions.includes(ext);
}

/** BR-PHOTO-005 — nome novo e aleatório; o nome do usuário é descartado. */
export const newPhotoName = () => `${randomUUID().replaceAll('-', '')}.jpg`;

/**
 * BR-PHOTO-004 — Valida e re-codifica a imagem.
 * @param {Buffer} buffer conteúdo enviado
 * @returns {Promise<Buffer>} JPEG pronto para salvar
 * @throws {ImageError}
 */
export async function processImage(buffer) {
  const options = { limitInputPixels: PHOTO_POLICY.maxPixels, failOn: 'error' };

  // 1ª passada: só o cabeçalho, para recusar cedo sem decodificar a imagem inteira.
  let meta;
  try {
    meta = await sharp(buffer, options).metadata();
  } catch (err) {
    throw toImageError(err);
  }
  if (!ACCEPTED_FORMATS.has(meta.format)) throw new ImageError(MESSAGES.notImage);
  if (!meta.width || !meta.height) throw new ImageError(MESSAGES.notImage);
  if (meta.width * meta.height > PHOTO_POLICY.maxPixels) throw new ImageError(MESSAGES.tooManyPixels);

  // 2ª passada: re-codifica. Sem keepMetadata(), o sharp não copia EXIF/ICC/XMP para a saída.
  try {
    return await sharp(buffer, options) // GIF animado: o sharp lê só o 1º quadro
      .rotate() // aplica a orientação do EXIF antes de descartá-lo
      .flatten({ background: '#ffffff' }) // transparência vira branco (RGB)
      .resize({ width: PHOTO_POLICY.maxWidth, withoutEnlargement: true })
      .toColourspace('srgb')
      .jpeg({ quality: PHOTO_POLICY.quality, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    throw toImageError(err);
  }
}

/** Erros do sharp viram mensagem para o usuário (o texto original não vaza). */
const toImageError = (err) =>
  new ImageError(/pixel limit/i.test(String(err?.message)) ? MESSAGES.tooManyPixels : MESSAGES.notImage);
