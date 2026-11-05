/**
 * common.js — Schemas reutilizáveis.
 * Spec: specs/domain/rules.md (BR-VAL-*)
 */
import { z } from 'zod';
import { PHONE_REGEX, PET_TYPES, PET_SIZES, POST_STATUSES, PARTNER_TYPES } from '@petspost/domain';

/** Texto obrigatório: trim + não vazio + limite de tamanho. */
export const requiredText = (max, message = 'Campo obrigatório.') =>
  z.string().trim().min(1, message).max(max, `Máximo de ${max} caracteres.`);

/** Texto opcional: string vazia vira null (igual ao comportamento do Flask). */
export const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

/** BR-VAL-001 */
export const phoneSchema = z
  .string()
  .trim()
  .regex(PHONE_REGEX, 'Telefone inválido. Use (XX) XXXX-XXXX ou (XX) XXXXX-XXXX.');

/** BR-VAL-002 — email normalizado para minúsculas. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Informe um email válido.'))
  .refine((v) => v.length <= 120, 'Máximo de 120 caracteres.');

export const petTypeSchema = z.enum(PET_TYPES, { message: 'Selecione o tipo de animal.' });
export const petSizeSchema = z.enum(PET_SIZES);
export const postStatusSchema = z.enum(POST_STATUSES);
export const partnerTypeSchema = z.enum(PARTNER_TYPES);

/** Paginação via query string (?page=2). Valores inválidos viram 1. */
export const pageQuerySchema = z.coerce.number().int().min(1).catch(1);
