/**
 * Serviço de fotos — BR-PHOTO-001..007. Não sabe de permissão: quem chama (o serviço de
 * posts) já conferiu que o usuário pode mexer no anúncio.
 */
import { PHOTO_POLICY } from '@petspost/domain';
import { HttpError } from '../../middleware/errors.js';
import { processImage, isAllowedName, newPhotoName, ImageError, MESSAGES } from '../../lib/images.js';

export const LIMIT_MESSAGE = `Limite de ${PHOTO_POLICY.maxPerPost} fotos por anúncio atingido.`;

/**
 * @param {{
 *   photos: ReturnType<typeof import('./repository.js').createPhotoRepository>,
 *   storage: ReturnType<typeof import('../../lib/storage.js').createDiskStorage>,
 *   logger?: { warn: Function, error: Function },
 *   maxPerOwner?: number,
 * }} deps
 */
export function createPhotoService({ photos, storage, logger = console, maxPerOwner = PHOTO_POLICY.maxPerPost }) {
  /** Apaga arquivos sem deixar o erro subir (BR-PHOTO-007: falha no disco só gera log). */
  async function removeFiles(filenames) {
    for (const name of filenames) {
      try {
        await storage.remove(name);
      } catch (err) {
        logger.warn({ err, file: name }, 'não consegui apagar o arquivo da foto');
      }
    }
  }

  /** Processa e salva uma foto. Erro esperado vira ImageError. */
  async function saveOne(ownerId, file, isPrimary) {
    if (!isAllowedName(file.originalname)) throw new ImageError(MESSAGES.extension); // BR-PHOTO-003
    const jpeg = await processImage(file.buffer); // BR-PHOTO-004
    const filename = newPhotoName(); // BR-PHOTO-005
    await storage.save(filename, jpeg);
    try {
      await photos.create(ownerId, { filename, url: storage.urlFor(filename), isPrimary });
    } catch (err) {
      await removeFiles([filename]); // não deixa arquivo órfão
      throw err;
    }
  }

  return {
    removeFiles,

    /**
     * Salva as fotos uma a uma. Falha em uma não impede as outras (BR-PHOTO-006).
     * @param {number} ownerId
     * @param {Array<{ originalname: string, buffer: Buffer }>} files
     * @returns {Promise<{ saved: number, rejected: Array<{ name: string, message: string }> }>}
     */
    async add(ownerId, files) {
      let current = await photos.count(ownerId);
      let saved = 0;
      const rejected = [];
      for (const file of files) {
        const name = String(file.originalname ?? '').slice(0, 255);
        if (current >= maxPerOwner) {
          rejected.push({ name, message: LIMIT_MESSAGE }); // BR-PHOTO-001
          continue;
        }
        try {
          await saveOne(ownerId, file, current === 0); // BR-PHOTO-002: a 1ª do post é a principal
          current += 1;
          saved += 1;
        } catch (err) {
          if (!(err instanceof ImageError)) logger.error({ err, file: name }, 'erro ao salvar foto');
          rejected.push({ name, message: err instanceof ImageError ? err.message : 'Não foi possível salvar esta foto.' });
        }
      }
      return { saved, rejected };
    },

    /** Remove registro + arquivo; promove outra principal se preciso (BR-PHOTO-002/007). */
    async remove(ownerId, photoId) {
      const photo = photoId ? await photos.findForOwner(ownerId, photoId) : null;
      if (!photo) throw new HttpError(404, 'NOT_FOUND', 'Foto não encontrada.');
      await photos.delete(photo.id);
      if (photo.isPrimary) await photos.promoteFirstIfNoPrimary(ownerId);
      await removeFiles([photo.filename]);
    },

    filenamesOf: (ownerId) => photos.filenamesOf(ownerId),
  };
}
