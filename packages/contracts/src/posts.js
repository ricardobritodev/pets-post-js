/**
 * posts.js — DTOs de posts de pets perdidos/encontrados.
 * Spec: specs/api/posts.md · BR-POST-001, BR-POST-003, BR-VAL-*
 * Mensagens iguais às do formulário do sistema antigo.
 */
import { z } from 'zod';
import { PET_TYPES, POST_STATUSES } from '@petspost/domain';
import {
  requiredText,
  optionalText,
  optionalEnum,
  optionalEmail,
  lenientEnum,
  phoneSchema,
  petTypeSchema,
  petSizeSchema,
  postStatusSchema,
  pageQuerySchema,
} from './common.js';

const postFields = {
  title: requiredText(150, 'O título é obrigatório.'),
  description: z.string().trim().min(1, 'A descrição é obrigatória.').max(5000, 'Máximo de 5000 caracteres.'),
  status: postStatusSchema,
  petType: petTypeSchema,
  lastSeenLocation: requiredText(255, 'A localização é obrigatória.'),
  contactPhone: z.string().trim().min(1, 'O telefone de contato é obrigatório.').pipe(phoneSchema),
  petName: optionalText(100),
  petBreed: optionalText(100),
  petColor: optionalText(100),
  petSize: optionalEnum(petSizeSchema),
  contactEmail: optionalEmail,
  reward: optionalText(100),
};

/** BR-POST-001 — campos obrigatórios e limites. Campos desconhecidos são descartados. */
export const createPostSchema = z.object(postFields);

/** PATCH: qualquer subconjunto dos campos, com as mesmas regras; precisa de pelo menos 1. */
export const updatePostSchema = z
  .object(postFields)
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Nada para atualizar.' });

/**
 * BR-POST-003 — filtros da listagem. Aceita `pet_type` (links antigos) além de `petType`.
 */
export const listPostsQuerySchema = z
  .object({
    status: lenientEnum(POST_STATUSES),
    petType: lenientEnum(PET_TYPES),
    pet_type: lenientEnum(PET_TYPES),
    page: pageQuerySchema.optional().default(1),
  })
  .transform(({ pet_type, petType, ...rest }) => ({ ...rest, petType: petType ?? pet_type }));

/** Só a paginação (ex.: /me/posts). */
export const pageOnlyQuerySchema = z.object({ page: pageQuerySchema.optional().default(1) });

/** `:id` da URL: inteiro positivo; qualquer outra coisa vira null (→ 404). */
export const idParamSchema = z.coerce.number().int().positive().max(2_147_483_647).catch(null);
