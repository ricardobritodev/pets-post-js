/**
 * adoption.js — DTOs de adoção.
 * Spec: specs/api/adoption.md · BR-ADOPT-001, BR-ADOPT-002, BR-ADOPT-004, BR-VAL-*
 */
import { z } from 'zod';
import { PET_TYPES } from '@petspost/domain';
import {
  requiredText,
  optionalText,
  optionalEnum,
  optionalEmail,
  lenientEnum,
  formBoolean,
  phoneSchema,
  petTypeSchema,
  petSizeSchema,
  pageQuerySchema,
} from './common.js';

const adoptionFields = {
  title: requiredText(150, 'O título é obrigatório.'),
  description: z.string().trim().min(1, 'A descrição é obrigatória.').max(5000, 'Máximo de 5000 caracteres.'),
  petType: petTypeSchema,
  location: requiredText(255, 'A localização é obrigatória.'),
  contactPhone: z.string().trim().min(1, 'O telefone de contato é obrigatório.').pipe(phoneSchema),
  petName: optionalText(100),
  petBreed: optionalText(100),
  petColor: optionalText(100),
  petSize: optionalEnum(petSizeSchema),
  // BR-ADOPT-001: castrado/vacinado são false quando não vêm.
  isNeutered: formBoolean.optional().default(false),
  isVaccinated: formBoolean.optional().default(false),
  adopterRequirements: optionalText(2000), // BR-ADOPT-004
  contactEmail: optionalEmail,
};

/** BR-ADOPT-001 — campos obrigatórios e limites. Campos desconhecidos são descartados. */
export const createAdoptionSchema = z.object(adoptionFields);

/** PATCH: subconjunto dos campos; sem os defaults (campo ausente = não mexe). */
export const updateAdoptionSchema = z
  .object({ ...adoptionFields, isNeutered: formBoolean, isVaccinated: formBoolean })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Nada para atualizar.' });

/** BR-ADOPT-002 — filtro por tipo (aceita `pet_type` dos links antigos); inválido é ignorado. */
export const listAdoptionQuerySchema = z
  .object({
    petType: lenientEnum(PET_TYPES),
    pet_type: lenientEnum(PET_TYPES),
    page: pageQuerySchema.optional().default(1),
  })
  .transform(({ pet_type, petType, ...rest }) => ({ ...rest, petType: petType ?? pet_type }));
