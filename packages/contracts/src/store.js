/**
 * store.js — DTOs da loja. Spec: specs/api/store.md · BR-STORE-002/003/005/006
 */
import { z } from 'zod';
import { PET_TYPES, PRODUCT_CATEGORIES, MAX_PRICE_CENTS } from '@petspost/domain';
import { requiredText, optionalText, optionalEnum, lenientEnum, formBoolean, petTypeSchema, pageQuerySchema } from './common.js';

const searchQuery = z.string().trim().max(100).optional().catch(undefined).transform((v) => (v ? v : undefined));
const optionalId = z.coerce.number().int().positive().optional().catch(undefined);
const page = pageQuerySchema.optional().default(1);

export const STORE_SORTS = Object.freeze(['featured', 'price_asc', 'price_desc', 'newest']);

/** Vitrine pública: filtros inválidos são ignorados. */
export const storeQuerySchema = z.object({
  q: searchQuery,
  category: lenientEnum(PRODUCT_CATEGORIES),
  petType: lenientEnum(PET_TYPES),
  partnerId: optionalId,
  sort: z.enum(STORE_SORTS).optional().catch(undefined).transform((v) => v ?? 'featured'),
  page,
});

export const adminProductsQuerySchema = z.object({
  q: searchQuery,
  category: lenientEnum(PRODUCT_CATEGORIES),
  partnerId: optionalId,
  visibility: lenientEnum(['active', 'hidden']),
  page,
});

const priceCents = z.coerce
  .number({ message: 'Informe o preço.' })
  .int('Preço em centavos (número inteiro).')
  .positive('O preço precisa ser maior que zero.')
  .max(MAX_PRICE_CENTS, 'Preço acima do limite (R$ 100.000,00).');

const optionalPrice = z
  .union([z.literal(''), z.null(), priceCents])
  .optional()
  .transform((v) => (v === '' || v == null ? null : v));

const httpUrl = z
  .union([z.literal(''), z.string().trim().max(500, 'Máximo de 500 caracteres.')])
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
  }, 'O link precisa começar com http:// ou https://.');

const productFields = {
  partnerId: z.coerce.number({ message: 'Selecione o parceiro.' }).int().positive('Selecione o parceiro.'),
  name: requiredText(150, 'O nome é obrigatório.'),
  description: optionalText(5000),
  category: z.enum(PRODUCT_CATEGORIES, { message: 'Selecione a categoria.' }),
  petType: optionalEnum(petTypeSchema), // vazio = serve para todos
  priceCents,
  promoPriceCents: optionalPrice,
  stock: z.coerce.number().int('Estoque inteiro.').min(0, 'Estoque não pode ser negativo.').max(1_000_000).optional().default(0),
  url: httpUrl,
  isActive: formBoolean.optional().default(true),
  isFeatured: formBoolean.optional().default(false),
};

/** BR-STORE-003 — promoção, quando existe, é menor que o preço. */
const promoBelowPrice = (d) => d.promoPriceCents == null || d.priceCents == null || d.promoPriceCents < d.priceCents;
const promoIssue = { message: 'O preço promocional precisa ser menor que o preço.', path: ['promoPriceCents'] };

/** BR-STORE-006 — cadastro de produto (só admin). */
export const productSchema = z.object(productFields).refine(promoBelowPrice, promoIssue);

/** PATCH: subconjunto; booleanos e estoque ausentes não mudam. */
export const updateProductSchema = z
  .object({ ...productFields, stock: productFields.stock.unwrap().unwrap(), isActive: formBoolean, isFeatured: formBoolean })
  .partial()
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: 'Nada para atualizar.' })
  .refine(promoBelowPrice, promoIssue);
