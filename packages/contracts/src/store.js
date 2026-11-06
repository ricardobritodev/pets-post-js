/**
 * store.js — DTOs da loja. Spec: specs/api/store.md · BR-STORE-002/003/005/006/013
 */
import { z } from 'zod';
import { PET_TYPES, PRODUCT_CATEGORIES, MAX_PRICE_CENTS, MAX_SELLER_NAME } from '@petspost/domain';
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
  sellerName: optionalText(MAX_SELLER_NAME), // BR-STORE-013 — vazio = nome do parceiro
  isActive: formBoolean.optional().default(true),
  isFeatured: formBoolean.optional().default(false),
};

/** BR-STORE-003 — promoção, quando existe, é menor que o preço. */
const promoBelowPrice = (d) => d.promoPriceCents == null || d.priceCents == null || d.promoPriceCents < d.priceCents;
const promoIssue = { message: 'O preço promocional precisa ser menor que o preço.', path: ['promoPriceCents'] };

/** BR-STORE-012 — loja que ainda não é parceira, cadastrada junto com o produto (vem da importação). */
const newPartnerSchema = z.object({
  name: requiredText(150, 'Informe o nome da loja.'),
  website: z.string().trim().max(255).refine((v) => {
    try {
      return ['http:', 'https:'].includes(new URL(v).protocol);
    } catch {
      return false;
    }
  }, 'Site da loja inválido.'),
});

/**
 * BR-STORE-006/012 — cadastro de produto (só admin): parceiro existente (`partnerId`) ou a loja nova (`newPartner`).
 * `when` faz a checagem do parceiro aparecer junto com os outros campos que faltam.
 */
export const productSchema = z
  .object({ ...productFields, partnerId: productFields.partnerId.optional(), newPartner: newPartnerSchema.nullish() })
  .refine((d) => d.partnerId != null || d.newPartner != null, {
    message: 'Selecione o parceiro.', path: ['partnerId'], when: (payload) => payload.value != null && typeof payload.value === 'object',
  })
  .refine(promoBelowPrice, promoIssue);

/** PATCH: subconjunto; booleanos e estoque ausentes não mudam. */
export const updateProductSchema = z
  .object({ ...productFields, stock: productFields.stock.unwrap().unwrap(), isActive: formBoolean, isFeatured: formBoolean })
  .partial()
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: 'Nada para atualizar.' })
  .refine(promoBelowPrice, promoIssue);

/** BR-STORE-009 — link para importar. A checagem de segurança (https, endereço público) é no servidor. */
export const productImportSchema = z.object({
  url: z.string({ message: 'Cole o link do produto.' }).trim().min(1, 'Cole o link do produto.').max(2000, 'Link longo demais.'),
});

/** Fotos escolhidas na importação (até 6). */
export const photoImportSchema = z.object({
  urls: z.array(z.string().trim().max(2000)).min(1, 'Escolha ao menos uma foto.').max(6, 'No máximo 6 fotos.'),
});
