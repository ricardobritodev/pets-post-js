/**
 * product-page.js — Lê os dados de produto que a própria loja publica na página (BR-STORE-009):
 *   1º schema.org `Product` em JSON-LD (o que o Google usa);
 *   2º Open Graph / meta tags (o que o WhatsApp usa).
 * Sem executar JavaScript da página e sem "raspar" o layout: se a loja não publica, não inventa.
 */
import { reaisToCents } from '@petspost/domain';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

export function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z#0-9]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Tira tags HTML de descrições e junta espaços. */
const plain = (text) => decodeEntities(String(text ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '))
  .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const isType = (node, type) => asArray(node?.['@type']).some((t) => String(t).toLowerCase() === type.toLowerCase());

/** Todos os objetos de um JSON-LD (inclui @graph e listas). */
function* walk(node) {
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n);
  } else if (node && typeof node === 'object') {
    yield node;
    if (node['@graph']) yield* walk(node['@graph']);
  }
}

function jsonLdBlocks(html) {
  const blocks = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      blocks.push(JSON.parse(m[1].trim()));
    } catch { /* bloco quebrado: ignora */ }
  }
  return blocks;
}

/** Preço em texto/número → centavos. */
function priceToCents(value) {
  if (value == null || value === '') return null;
  const cents = reaisToCents(typeof value === 'number' ? value.toFixed(2) : String(value));
  return cents && cents > 0 ? cents : null;
}

function imageUrls(image) {
  return asArray(image).map((i) => (typeof i === 'string' ? i : i?.url ?? i?.contentUrl)).filter((u) => typeof u === 'string');
}

function fromJsonLd(html) {
  for (const block of jsonLdBlocks(html)) {
    for (const node of walk(block)) {
      let product = null;
      if (isType(node, 'Product')) product = node;
      else if (isType(node, 'ProductGroup')) product = { ...node, ...asArray(node.hasVariant)[0], name: node.name };
      if (!product?.name) continue;
      const offers = asArray(product.offers).flatMap((o) => (isType(o, 'AggregateOffer') ? [o, ...asArray(o.offers)] : [o]));
      const offer = offers.find((o) => o?.price != null || o?.lowPrice != null || o?.priceSpecification) ?? offers[0] ?? {};
      const price = offer.price ?? offer.lowPrice ?? asArray(offer.priceSpecification)[0]?.price;
      const availability = String(offer.availability ?? '');
      return {
        name: plain(product.name),
        description: plain(product.description),
        priceCents: priceToCents(price),
        inStock: availability ? /InStock|LimitedAvailability|OnlineOnly|PreOrder/i.test(availability) : null,
        imageUrls: imageUrls(product.image),
        url: typeof product.url === 'string' ? product.url : null,
      };
    }
  }
  return null;
}

/** Valor de uma meta tag (property= ou name=), na ordem em que aparecem. */
function metaAll(html, key) {
  const values = [];
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const k = /(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (k?.toLowerCase() !== key) continue;
    const v = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (v != null) values.push(decodeEntities(v).trim());
  }
  return values;
}
const meta = (html, ...keys) => keys.map((k) => metaAll(html, k)[0]).find((v) => v) ?? null;

function fromMeta(html) {
  const name = meta(html, 'og:title', 'twitter:title') ?? plain(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '');
  if (!name) return null;
  const availability = meta(html, 'product:availability', 'og:availability');
  return {
    name: plain(name),
    description: plain(meta(html, 'og:description', 'description', 'twitter:description')),
    priceCents: priceToCents(meta(html, 'product:price:amount', 'og:price:amount', 'price')),
    inStock: availability ? /instock|in stock|available|disponivel/i.test(availability.replace(/\s/g, ' ')) : null,
    imageUrls: [...metaAll(html, 'og:image'), ...metaAll(html, 'og:image:secure_url'), ...metaAll(html, 'twitter:image')],
    url: meta(html, 'og:url'),
  };
}

/**
 * @param {string} html
 * @param {string} pageUrl URL final da página (para resolver links relativos)
 * @returns {{ name: string, description: string, priceCents: number|null, inStock: boolean|null,
 *            imageUrls: string[], url: string, siteName: string|null, source: 'json-ld'|'meta' } | null}
 */
export function parseProductPage(html, pageUrl) {
  const ld = fromJsonLd(html);
  const og = fromMeta(html);
  const base = ld ?? og;
  if (!base) return null;
  // Completa o que faltou no JSON-LD com as meta tags (ex.: só o og:image tem foto).
  const merged = {
    ...base,
    description: base.description || og?.description || '',
    priceCents: base.priceCents ?? og?.priceCents ?? null,
    inStock: base.inStock ?? og?.inStock ?? null,
    imageUrls: base.imageUrls.length ? base.imageUrls : (og?.imageUrls ?? []),
  };
  const canonical = /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html)?.[1]
    ?? /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i.exec(html)?.[1];
  const absolute = (u) => {
    try {
      const abs = new URL(decodeEntities(u), pageUrl);
      return abs.protocol === 'https:' ? abs.toString() : null;
    } catch {
      return null;
    }
  };
  return {
    name: merged.name.slice(0, 150),
    description: merged.description.slice(0, 5000),
    priceCents: merged.priceCents,
    inStock: merged.inStock,
    imageUrls: [...new Set(merged.imageUrls.map(absolute).filter(Boolean))].slice(0, 6),
    url: absolute(canonical ?? merged.url ?? pageUrl) ?? pageUrl,
    siteName: meta(html, 'og:site_name') ?? new URL(pageUrl).hostname.replace(/^www\./, ''),
    source: ld ? 'json-ld' : 'meta',
  };
}
