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

/** Maior tamanho do nome do vendedor (BR-STORE-013). */
export const MAX_SELLER_NAME = 120;

/** "https://www.Loja.com.br/x" → "loja.com.br". Link inválido → null. */
export function siteDomain(url) {
  try {
    const { protocol, hostname } = new URL(String(url ?? '').trim());
    if (protocol !== 'http:' && protocol !== 'https:') return null;
    return hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

/**
 * BR-STORE-012 — o link é do site da loja? Mesmo domínio (sem www.) ou subdomínio dela
 * (ex.: link em "loja.petz.com.br" e site "petz.com.br").
 */
export function sameSite(linkUrl, website) {
  const link = siteDomain(linkUrl);
  const site = siteDomain(website);
  if (!link || !site) return false;
  return link === site || link.endsWith(`.${site}`);
}

const alnum = (s) => fold(s).replace(/[^a-z0-9]/g, '');
/** Partes do domínio que não dizem o nome da loja (loja.exemplo.com.br, m.loja.com…). */
const GENERIC_LABELS = new Set(['www', 'm', 'loja', 'shop', 'store', 'petshop', 'site', 'online', 'com', 'br', 'net', 'org']);

/** "https://www.petcenter.com.br/x" → "petcenter"; "petshop.drhato.com.br" → "drhato". null se não der. */
export function domainLabel(url) {
  const domain = siteDomain(url);
  if (!domain) return null;
  return domain.split('.').find((l) => l.length >= 3 && !GENERIC_LABELS.has(l)) ?? null;
}

/**
 * BR-STORE-012 — nome da loja para cadastrar como parceiro: o vendedor da página, senão o `og:site_name`
 * (sem o slogan depois de " - " ou " | "), senão o domínio com inicial maiúscula.
 */
export function storeNameFor({ sellerName, siteName, url } = {}) {
  const site = String(siteName ?? '').split(/\s+[|–—-]\s+/)[0].trim();
  const fromSite = site && !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(site) ? site : null; // "loja.com.br" não é nome; "Zee.Dog" é
  const label = domainLabel(url);
  const name = String(sellerName ?? '').trim() || fromSite || (label ? label[0].toUpperCase() + label.slice(1) : null);
  return name ? name.slice(0, 150) : null;
}

/** "https://www.loja.com.br/produto/x" → "https://www.loja.com.br" (site da loja). */
export function siteOrigin(url) {
  try {
    const u = new URL(String(url ?? '').trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : null;
  } catch {
    return null;
  }
}

/**
 * BR-STORE-012 — qual parceiro vende o produto do link.
 *   1º site com o mesmo domínio; 2º nome do parceiro que contém o nome da loja ou o nome do domínio.
 * Prefere os ativos; entre eles, o que tem o nome do vendedor da página; senão o primeiro.
 * @template {{ id: number, name: string, website?: string|null, isActive: boolean }} P
 * @param {string} linkUrl
 * @param {P[]} partners
 * @param {string|null} [sellerName]
 * @param {string|null} [siteName]
 * @returns {{ matches: P[], chosen: P|null, by: 'site'|'name'|null }}
 */
export function matchPartnersBySite(linkUrl, partners, sellerName, siteName) {
  let matches = partners.filter((p) => sameSite(linkUrl, p.website));
  let by = matches.length ? 'site' : null;
  if (!matches.length) {
    // parceiro com outro site cadastrado é outra loja: só os sem site entram na busca pelo nome
    const names = [domainLabel(linkUrl), storeNameFor({ sellerName, siteName })].map(alnum).filter((n) => n.length >= 4);
    matches = partners.filter((p) => !siteDomain(p.website) && names.some((n) => alnum(p.name).includes(n)));
    by = matches.length ? 'name' : null;
  }
  const pool = matches.some((p) => p.isActive) ? matches.filter((p) => p.isActive) : matches;
  const seller = fold(sellerName).trim();
  const byName = seller ? pool.find((p) => fold(p.name).trim() === seller) ?? pool.find((p) => fold(p.name).startsWith(seller)) : null;
  return { matches, chosen: byName ?? pool[0] ?? null, by };
}

/** BR-STORE-013 — quem aparece em "Vendido e entregue por": o vendedor do produto ou o parceiro. */
export function soldBy(product, partner) {
  const seller = String(product?.sellerName ?? '').trim();
  return seller || partner?.name || null;
}
