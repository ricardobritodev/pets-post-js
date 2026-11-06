/**
 * upload.js — Lê as fotos de um multipart/form-data para a memória (BR-PHOTO-003).
 *
 * O total da requisição é limitado a 8 MB pelo Content-Length, antes de ler qualquer byte.
 * O Node garante que o corpo não passa do Content-Length declarado, então esse limite vale.
 * Os arquivos ficam só na memória: o que vai para o disco é a versão re-codificada (BR-PHOTO-004).
 */
import multer from 'multer';
import { PHOTO_POLICY } from '@petspost/domain';
import { HttpError } from './errors.js';

/** Teto de arquivos por requisição. O limite de 6 por post é aplicado no serviço (BR-PHOTO-001). */
const MAX_FILES = 20;

const megabytes = (bytes) => Math.round(bytes / 1024 / 1024);

/**
 * @param {{ field?: string, maxBytes?: number }} [options]
 * @returns {import('express').RequestHandler[]}
 */
export function photoUpload({ field = 'photos', maxBytes = PHOTO_POLICY.maxRequestBytes } = {}) {
  const tooLarge = () =>
    new HttpError(413, 'PAYLOAD_TOO_LARGE', `As fotos passam de ${megabytes(maxBytes)} MB no total. Envie menos fotos ou fotos menores.`);

  const parse = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: MAX_FILES, fields: 10, parts: MAX_FILES + 10 },
  }).array(field, MAX_FILES);

  const checkHeaders = (req, _res, next) => {
    if (!req.is('multipart/form-data')) {
      return next(new HttpError(400, 'VALIDATION_ERROR', `Envie as fotos como multipart/form-data, no campo "${field}".`));
    }
    const length = Number(req.headers['content-length']);
    if (!req.headers['content-length'] || !Number.isSafeInteger(length)) {
      return next(new HttpError(411, 'LENGTH_REQUIRED', 'Envio sem tamanho declarado (Content-Length).'));
    }
    if (length > maxBytes) return next(tooLarge());
    return next();
  };

  const run = (req, res, next) =>
    parse(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return next(tooLarge());
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(new HttpError(400, 'VALIDATION_ERROR', `As fotos devem vir no campo "${field}".`));
        }
        return next(new HttpError(400, 'VALIDATION_ERROR', 'Envio de fotos inválido.'));
      }
      if (err) return next(err);
      if (!req.files?.length) return next(new HttpError(400, 'VALIDATION_ERROR', 'Nenhuma foto enviada.'));
      return next();
    });

  return [checkHeaders, run];
}
