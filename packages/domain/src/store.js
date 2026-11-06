/**
 * store.js — Regras puras da loja (vitrine). Spec: specs/api/store.md · BR-STORE-003/005
 * Sem I/O e sem node:crypto: o front importa por '@petspost/domain/store'.
 */

export const STORE_PAGE_SIZE = 24;
/** Teto de preço: R$ 100.000,00. */
export const MAX_PRICE_CENTS = 10_000_000;

/** Promoção só vale se for menor que o preço (BR-STORE-003). */
export const hasPromo = (p) => Number.isInteger(p.promoPriceCents) && p.promoPriceCents > 0 && p.promoPriceCents < p.priceCents;

export const finalPriceCents = (p) => (hasPromo(p) ? p.promoPriceCents : p.priceCents);

/** Desconto em %, arredondado para baixo (nunca anuncia mais desconto do que dá). null sem promoção. */
export function discountPercent(p) {
  if (!hasPromo(p)) return null;
  return Math.floor(((p.priceCents - p.promoPriceCents) / p.priceCents) * 100);
}

const isHttp = (url) => {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    return ['http:', 'https:'].includes(new URL(url.trim()).protocol);
  } catch {
    return false;
  }
};

export const productWhatsappMessage = (name) => `Olá! Vi o produto *${name}* no Pets Post e gostaria de saber mais. 🐾`;

/**
 * BR-STORE-005 — para onde o botão de compra leva: link do produto → site do parceiro → WhatsApp.
 * @param {{ url?: string|null }} product
 * @param {{ website?: string|null, whatsappUrl?: string|null }} partner whatsappUrl já montado
 * @returns {{ url: string|null, channel: 'product'|'site'|'whatsapp'|null }}
 */
export function buyLink(product, partner) {
  if (isHttp(product.url)) return { url: product.url.trim(), channel: 'product' };
  if (isHttp(partner?.website)) return { url: partner.website.trim(), channel: 'site' };
  if (partner?.whatsappUrl) return { url: partner.whatsappUrl, channel: 'whatsapp' };
  return { url: null, channel: null };
}

/**
 * "189,90" · "R$ 1.234,56" · "189.90" · "189" → centavos. Inválido → null.
 * Com vírgula, o ponto é separador de milhar (formato brasileiro).
 */
export function reaisToCents(text) {
  let s = String(text ?? '').replace(/R\$|\s/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // "1.234" = mil duzentos e trinta e quatro
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [int, frac = ''] = s.split('.');
  return Number(int) * 100 + Number(frac.padEnd(2, '0'));
}

/** Centavos → "R$ 1.234,56". */
export const formatBRL = (cents) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Centavos → "1234,56" (para preencher o campo do formulário). */
export const centsToInput = (cents) => (cents == null ? '' : (cents / 100).toFixed(2).replace('.', ','));

const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Palavras do nome do produto → categoria (BR-STORE-009: só sugestão, o admin confirma). Ordem importa. */
const CATEGORY_HINTS = [
  ['health', /\b(antipulgas?|vermifugo|carrapat\w*|remedio|medicamento|suplemento|vitamina|pomada|coleira antipulgas)\b/],
  ['beds', /\b(cama|caminha|casinha|casa para|colchonete|almofada|toca)\b/],
  ['hygiene', /\b(shampoo|condicionador|tapete higienico|areia|granulado|lenco|perfume|colonia|escova de dente|creme dental|higien\w*)\b/],
  ['treats', /\b(petisco|bifinho|snack|biscoito|osso|palito|sache petisco|stick)\b/],
  ['toys', /\b(brinquedo|bola|bolinha|mordedor|pelucia|varinha|arranhador|corda)\b/],
  ['accessories', /\b(coleira|guia|peitoral|comedouro|bebedouro|caixa de transporte|transporte|roupa|plaquinha|focinheira)\b/],
  ['food', /\b(racao|alimento|sache|umida|seca|patê|pate|lata|graos|sementes|mistura)\b/],
];

const PET_HINTS = [
  ['cat', /\b(gatos?|gatas?|felinos?|cat)\b/],
  ['dog', /\b(caes|cao|cachorros?|caninos?|dog|filhotes de caes)\b/],
  ['bird', /\b(passaros?|aves?|calopsitas?|periquitos?|canarios?|papagaios?)\b/],
  ['other', /\b(roedores?|hamsters?|coelhos?|peixes?|aquario|repteis?|tartarugas?)\b/],
];

/** Sugere a categoria pelo texto (nome/descrição). null se não reconhecer. */
export function suggestCategory(text) {
  const t = fold(text);
  return CATEGORY_HINTS.find(([, re]) => re.test(t))?.[0] ?? null;
}

/** Sugere o tipo de pet. null = não deu para saber (ou serve para todos). */
export function suggestPetType(text) {
  const t = fold(text);
  const found = PET_HINTS.filter(([, re]) => re.test(t)).map(([pet]) => pet);
  return found.length === 1 ? found[0] : null; // "cães e gatos" → null (todos os pets)
}
