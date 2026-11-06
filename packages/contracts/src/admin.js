/**
 * admin.js — DTOs do painel admin. Spec: specs/api/admin.md · BR-ADMIN-*, BR-PARTNER-002
 */
import { z } from 'zod';
import { POST_STATUSES, PARTNER_TYPES } from '@petspost/domain';
import {
  requiredText,
  optionalText,
  optionalEmail,
  lenientEnum,
  formBoolean,
  phoneSchema,
  pageQuerySchema,
} from './common.js';

/** Busca livre: espaços nas pontas saem; vazio vira undefined; no máximo 100 caracteres. */
const searchQuery = z
  .string()
  .trim()
  .max(100)
  .optional()
  .catch(undefined)
  .transform((v) => (v ? v : undefined));

const page = pageQuerySchema.optional().default(1);

export const adminUsersQuerySchema = z.object({ q: searchQuery, page });

/** Moderação: `visibility` e `status` inválidos são ignorados, como nas listas públicas. */
export const adminListingsQuerySchema = z.object({
  q: searchQuery,
  visibility: lenientEnum(['active', 'hidden']),
  status: lenientEnum(POST_STATUSES),
  page,
});

/** BR-ADMIN-003 — ocultar/reexibir. Só aceita booleano de verdade. */
export const visibilitySchema = z.object({ isActive: z.boolean({ message: 'Informe isActive como true ou false.' }) });

export const adminPartnersQuerySchema = z.object({ q: searchQuery, type: lenientEnum(PARTNER_TYPES), page });

/** Vazio vira null; preenchido tem que ser http/https (BR-PARTNER-002). */
const websiteSchema = z
  .union([z.literal(''), z.string().trim().max(255, 'Máximo de 255 caracteres.')])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => {
    if (v === null) return true;
    try {
      return ['http:', 'https:'].includes(new URL(v).protocol);
    } catch {
      return false;
    }
  }, 'O site precisa começar com http:// ou https://.');

/** Telefone opcional: vazio vira null; preenchido segue o formato (BR-VAL-001). */
const optionalPhone = z
  .union([z.literal(''), phoneSchema])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

const coord = (max, name) =>
  z.union([z.literal(''), z.coerce.number().min(-max, `${name} inválida.`).max(max, `${name} inválida.`)])
    .optional()
    .nullable()
    .transform((v) => (v === '' || v === undefined ? undefined : v));

const partnerFields = {
  name: requiredText(150, 'O nome é obrigatório.'),
  type: z.enum(PARTNER_TYPES, { message: 'Selecione o tipo de parceiro.' }),
  address: requiredText(255, 'O endereço é obrigatório.'),
  description: optionalText(2000),
  phone: optionalPhone,
  email: optionalEmail,
  website: websiteSchema,
  isActive: formBoolean.optional().default(true),
  lat: coord(90, 'Latitude'),
  lng: coord(180, 'Longitude'),
};

const latLngTogether = (d) => (d.lat == null) === (d.lng == null);
const latLngIssue = { message: 'Informe latitude e longitude juntas (ou deixe as duas vazias).', path: ['lat'] };

/** BR-PARTNER-002 — cadastro de parceiro (só admin). */
export const partnerSchema = z.object(partnerFields).refine(latLngTogether, latLngIssue);

/** PATCH: subconjunto; `isActive` ausente não muda. */
export const updatePartnerSchema = z
  .object({ ...partnerFields, isActive: formBoolean })
  .partial()
  .refine((d) => Object.keys(d).filter((k) => d[k] !== undefined).length > 0, { message: 'Nada para atualizar.' })
  .refine(latLngTogether, latLngIssue);
