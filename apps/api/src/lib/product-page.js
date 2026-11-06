/**
 * product-page.js — Lê os dados de produto que a própria loja publica na página (BR-STORE-009/014):
 *   1º schema.org `Product`/`ProductGroup` em JSON-LD (o que o Google usa), em qualquer nível do bloco;
 *   2º `skuJson` das lojas VTEX antigas (os dados do produto que a plataforma põe na página);
 *   3º microdados (`itemprop`) e Open Graph / meta tags (o que o WhatsApp usa).
 * O que faltar num é completado pelo seguinte.
 * Página com variações (`ProductGroup`): vale a variação que o link aponta (?idsku=, ?sku=, URL dela).
 * Sem executar JavaScript da página e sem "raspar" o layout: se a loja não publica, não inventa.
 */
import { reaisToCents, MAX_SELLER_NAME } from '@petspost/domain';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

const codePoint = (n) => {
  try {
    return String.fromCodePoint(n);
  } catch {
    return '';
  }
};

export function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => codePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => codePoint(Number(dec)))
    .replace(/&([a-z#0-9]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Tira tags HTML de descrições e junta espaços. */
const plain = (text) => decodeEntities(String(text ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '))
  .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const isType = (node, type) => asArray(node?.['@type']).some((t) => String(t).toLowerCase() === type.toLowerCase());
const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const PRODUCT_TYPES = ['Product', 'ProductGroup', 'IndividualProduct', 'ProductModel'];
const isProduct = (node) => PRODUCT_TYPES.some((t) => isType(node, t));

/** Chaves que levam a *outros* produtos (relacionados, listas) — não são o produto da página. */
const OTHER_PRODUCTS = new Set(['hasVariant', 'isVariantOf', 'isRelatedTo', 'isSimilarTo', 'isAccessoryOrSparePartFor',
  'isConsumableFor', 'itemListElement', 'review', 'aggregateRating', 'offers']);

/** Todos os objetos de um JSON-LD, em qualquer nível (ex.: a Zee.Dog põe o Product dentro de `product`). */
function* walk(node, depth = 0) {
  if (depth > 12) return;
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n, depth + 1);
    return;
  }
  if (!node || typeof node !== 'object') return;
  yield node;
  for (const [key, value] of Object.entries(node)) {
    if (value && typeof value === 'object' && !OTHER_PRODUCTS.has(key)) yield* walk(value, depth + 1);
  }
}

/** JSON.parse que aceita o que as lojas costumam errar: quebra de linha crua dentro de texto e vírgula sobrando. */
function parseJsonLoose(text) {
  const t = String(text).trim()
    .replace(/^<!--|-->$/g, '')
    .replace(/^\/\*\s*<!\[CDATA\[\s*\*\/|\/\*\s*\]\]>\s*\*\/$/g, '')
    .trim();
  try {
    return JSON.parse(t);
  } catch {
    try {
      return JSON.parse(t.replace(/[\u0000-\u001f]+/g, ' ').replace(/,\s*([}\]])/g, '$1'));
    } catch {
      return null;
    }
  }
}

function jsonLdBlocks(html) {
  const blocks = [];
  // `type` com ou sem aspas (a Wake/Fbits escreve type=application/ld+json)
  for (const m of html.matchAll(/<script\b[^>]*?\btype\s*=\s*(["']?)application\/ld\+json\1[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    const data = parseJsonLoose(m[2]);
    if (data != null) blocks.push(data);
  }
  return blocks;
}

/** Preço em texto/número → centavos. Zero ou inválido → null. */
function priceToCents(value) {
  if (value == null || value === '') return null;
  const cents = reaisToCents(typeof value === 'number' ? value.toFixed(2) : String(value).trim());
  return cents && cents > 0 ? cents : null;
}

const IN_STOCK = /InStock|LimitedAvailability|OnlineOnly|InStoreOnly|PreOrder|PreSale|BackOrder/i;
const availabilityToStock = (value) => {
  const text = String(value ?? '').trim();
  return text ? IN_STOCK.test(text) : null;
};

function imageUrls(image) {
  return asArray(image).map((i) => (typeof i === 'string' ? i : i?.url ?? i?.contentUrl)).filter((u) => typeof u === 'string');
}

/** Nome de quem vende: texto ou Organization/Person. Só número (id interno, ex. Americanas "1") não serve. */
function sellerOf(seller) {
  const name = plain(typeof seller === 'string' ? seller : asArray(seller)[0]?.name);
  return name.length >= 2 && !/^\d+$/.test(name) ? name : null;
}

/** Dados de uma oferta: preço "por" (SalePrice, quando a loja separa), disponibilidade e vendedor. */
function offerData(product) {
  const offers = asArray(product.offers).flatMap((o) => (isType(o, 'AggregateOffer') ? [o, ...asArray(o.offers)] : [o]));
  const priceOf = (o) => {
    const specs = asArray(o?.priceSpecification);
    const sale = specs.find((s) => /SalePrice/i.test(String(s?.priceType ?? ''))) ?? specs[0];
    return priceToCents(o?.price) ?? priceToCents(o?.lowPrice) ?? priceToCents(sale?.price);
  };
  // prefere a oferta com preço e em estoque; senão qualquer uma com preço
  const offer = offers.find((o) => priceOf(o) != null && availabilityToStock(o?.availability) !== false)
    ?? offers.find((o) => priceOf(o) != null) ?? offers[0] ?? {};
  return { priceCents: priceOf(offer), inStock: availabilityToStock(offer.availability), sellerName: sellerOf(offer.seller) };
}

/** Parâmetros do link (?idsku=779423 → '779423') e o caminho, para achar a variação. */
function linkParts(pageUrl) {
  try {
    const url = new URL(pageUrl);
    return { url, params: new Set([...url.searchParams.values()].filter(Boolean)) };
  } catch {
    return null;
  }
}

/**
 * BR-STORE-009 — a variação que o link aponta: mesma URL (caminho + query) ou o sku/gtin num parâmetro do link.
 * Nenhuma bate → null (fica a primeira, com o nome do grupo).
 */
function pickVariant(variants, pageUrl) {
  const link = linkParts(pageUrl);
  if (!link) return null;
  const sameUrl = (u) => {
    try {
      const v = new URL(u, link.url);
      return v.pathname === link.url.pathname && v.search === link.url.search;
    } catch {
      return false;
    }
  };
  return variants.find((v) => typeof v.url === 'string' && sameUrl(v.url))
    ?? (link.params.size ? variants.find((v) => [v.sku, v.productID, v.gtin, v.gtin13, v.mpn].some((id) => id != null && link.params.has(String(id)))) : null)
    ?? null;
}

/** Mesmo caminho do link? (para preferir o Product da página entre vários) */
const samePath = (u, pageUrl) => {
  try {
    return new URL(u, pageUrl).pathname.replace(/\/$/, '') === new URL(pageUrl).pathname.replace(/\/$/, '');
  } catch {
    return false;
  }
};

/**
 * BR-STORE-014 — os Product do JSON-LD, o da página primeiro: mesmo caminho do link > com oferta > ordem.
 * Lojas com plugins de SEO publicam o mesmo produto 2 ou 3 vezes, cada vez com um pedaço (ex.: Terra Zoo).
 */
function productNodes(html, pageUrl) {
  const candidates = [];
  for (const block of jsonLdBlocks(html)) {
    for (const node of walk(block)) if (isProduct(node) && node.name) candidates.push(node);
  }
  const score = (n) => (typeof n.url === 'string' && samePath(n.url, pageUrl) ? 4 : 0)
    + (n.offers || n.hasVariant ? 2 : 0);
  return candidates.map((n, i) => [n, score(n) * 1000 - i]).sort((a, b) => b[1] - a[1]).map(([n]) => n);
}

function fromJsonLd(html, pageUrl) {
  const [node, ...others] = productNodes(html, pageUrl);
  if (!node) return null;
  const main = productData(node, pageUrl);
  // Os outros blocos do *mesmo* produto (mesmo nome ou mesmo caminho) completam o que faltou.
  const key = alnum(node.name);
  const sameName = (o) => {
    const k = alnum(o.name);
    return k.startsWith(key) || key.startsWith(k); // "Ração X" e "Ração X - Terra Zoo"
  };
  const same = others.filter((o) => sameName(o) || (typeof o.url === 'string' && samePath(o.url, pageUrl)));
  for (const extra of same.map((o) => productData(o, pageUrl))) {
    for (const key of ['description', 'priceCents', 'inStock', 'sellerName']) if (main[key] == null || main[key] === '') main[key] = extra[key];
    if (!main.imageUrls.length) main.imageUrls = extra.imageUrls;
  }
  return main;
}

function productData(node, pageUrl) {
  let product = node;
  let variantUrl = null;
  if (isType(node, 'ProductGroup')) {
    const variants = asArray(node.hasVariant).filter((v) => v && typeof v === 'object');
    const chosen = pickVariant(variants, pageUrl);
    if (chosen) {
      product = { ...node, ...chosen, name: chosen.name ?? node.name, description: chosen.description ?? node.description, image: chosen.image ?? node.image };
      variantUrl = typeof chosen.url === 'string' ? chosen.url : pageUrl;
    } else {
      product = { ...node, ...variants[0], name: node.name };
    }
  }
  return {
    name: plain(product.name),
    description: plain(product.description),
    ...offerData(product),
    imageUrls: imageUrls(product.image),
    url: typeof product.url === 'string' ? product.url : null,
    variantUrl,
  };
}

/** Recorta o objeto JSON que começa em `start` (conta chaves, respeitando textos). */
function jsonObjectAt(text, start) {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length && i < start + 500_000; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

/**
 * BR-STORE-014 — lojas VTEX antigas (ex.: Dr. Hato) não têm JSON-LD, mas a plataforma põe os dados do produto
 * em `skuJson_0 = {...}`: nome, skus com preço em centavos (`bestPrice`), disponibilidade, foto e vendedor.
 */
function fromVtexSkuJson(html, pageUrl) {
  const m = /\bskuJson(?:_\d+)?\s*=\s*\{/.exec(html);
  if (!m) return null;
  const data = parseJsonLoose(jsonObjectAt(html, m.index + m[0].length - 1) ?? '');
  if (!data?.name || !Array.isArray(data.skus) || !data.skus.length) return null;
  const params = linkParts(pageUrl)?.params ?? new Set();
  const sku = data.skus.find((s) => params.has(String(s.sku))) ?? data.skus.find((s) => s.available) ?? data.skus[0];
  const cents = Number.isInteger(sku.bestPrice) && sku.bestPrice > 0 ? sku.bestPrice : null;
  return {
    name: plain(data.name),
    description: '',
    priceCents: cents,
    inStock: typeof sku.available === 'boolean' ? sku.available : (typeof data.available === 'boolean' ? data.available : null),
    sellerName: sellerOf(sku.sellerName ?? sku.seller),
    imageUrls: typeof sku.image === 'string' ? [sku.image] : [],
    url: null,
    variantUrl: null,
  };
}

/** Valor de um atributo de uma tag (com aspas duplas, simples ou sem aspas). */
const attr = (tag, name) => {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(tag);
  return m ? decodeEntities(m[1] ?? m[2] ?? m[3]).trim() : null;
};

/** Valores de meta tags (property= ou name=), na ordem em que aparecem. */
function metaAll(html, key) {
  const values = [];
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const k = attr(m[0], 'property') ?? attr(m[0], 'name');
    if (k?.toLowerCase() !== key) continue;
    const v = attr(m[0], 'content');
    if (v != null) values.push(v);
  }
  return values;
}
const meta = (html, ...keys) => keys.map((k) => metaAll(html, k)[0]).find((v) => v) ?? null;

/** BR-STORE-014 — microdados: `itemprop` em qualquer tag (span, link, meta…), valor em content/href/src. */
function itemprops(html, prop) {
  const values = [];
  for (const m of html.matchAll(/<[a-z][a-z0-9]*\b[^>]*\bitemprop\s*=[^>]*>/gi)) {
    if (!(attr(m[0], 'itemprop') ?? '').split(/\s+/).includes(prop)) continue;
    const v = attr(m[0], 'content') ?? attr(m[0], 'href') ?? attr(m[0], 'src');
    if (v) values.push(v);
  }
  return values;
}

function fromMeta(html) {
  // Mesmo sem nome, devolve o resto: serve para completar o JSON-LD (ex.: Tray com preço 0 no JSON-LD).
  const name = meta(html, 'og:title', 'twitter:title') ?? plain(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '');
  const availability = meta(html, 'product:availability', 'og:availability') ?? itemprops(html, 'availability')[0];
  const ogType = (meta(html, 'og:type') ?? '').toLowerCase();
  const priceCents = priceToCents(meta(html, 'product:price:amount', 'og:price:amount')) ?? priceToCents(itemprops(html, 'price')[0]);
  const ogImages = [...metaAll(html, 'og:image'), ...metaAll(html, 'og:image:secure_url'), ...metaAll(html, 'twitter:image')];
  return {
    name: plain(name),
    description: plain(meta(html, 'og:description', 'description', 'twitter:description')),
    priceCents,
    inStock: availability ? /instock|in stock|available|disponivel|^in_stock$/i.test(availability.replace(/\s/g, ' ')) && !/out ?of ?stock|outofstock|soldout/i.test(availability) : null,
    // itemprop image só sem og:image: na Loja Integrada ele também marca as fotos dos produtos relacionados
    imageUrls: ogImages.length ? ogImages : itemprops(html, 'image').slice(0, 1),
    url: meta(html, 'og:url'),
    sellerName: null,
    // dá para dizer que é página de produto? (og:type product, preço ou microdados de Product)
    productish: ogType.includes('product') || priceCents != null || /itemtype\s*=\s*["']?https?:\/\/schema\.org\/Product/i.test(html),
  };
}

/**
 * BR-STORE-009 — lojas VTEX (Cobasi e outras) publicam no JSON-LD/og:image só a miniatura (`/arquivos/ids/ID-194-194/`).
 * A mesma foto existe em outros tamanhos no mesmo endereço; pede a de 1200 px, que a própria página usa.
 */
export function largerImage(url) {
  return url.replace(/(\/arquivos\/ids\/\d+)-(\d+)-(\d+)(?=\/)/, (m, id, w, h) =>
    (Number(w) < 800 && Number(h) < 800 ? `${id}-1200-1200` : m));
}

/** BR-STORE-014 — a mesma foto em tamanhos diferentes (…/800x800/… e …/300x300/…, ?w=&h=) conta uma vez. */
const imageKey = (url) => url
  .replace(/\/\d{2,4}x\d{2,4}\//, '/')
  .replace(/(\/arquivos\/ids\/\d+)-\d+-\d+/, '$1')
  .replace(/([?&])(w|h|width|height|size|v)=[^&]*/gi, '$1')
  .replace(/[?&]+$/, '');

/** "loja.com.br" / "Zee.Dog" → "zeedog" (para reconhecer o nome da loja no fim do nome do produto). */
const alnum = (s) => fold(s).replace(/[^a-z0-9]/g, '');
const MARKETING = /^(frete|compre|loja\b|site oficial|oficial|ofertas?|promoc|melhor preco|menor preco|entrega)/;

/**
 * BR-STORE-014 — tira do nome o que é da loja, não do produto: "Ração X | Amazon.com.br", "Bebedouro - Frete Rápido".
 * " | " corta no primeiro trecho com o nome da loja; " - " só no último trecho. O primeiro trecho sempre fica.
 */
export function cleanProductName(name, { siteName, pageUrl } = {}) {
  let host = '';
  try {
    const labels = new URL(pageUrl).hostname.replace(/^www\./, '').split('.');
    host = labels.find((l) => l.length > 3 && !['shop', 'loja', 'petshop', 'store'].includes(l)) ?? labels[0];
  } catch { /* sem link */ }
  const brands = [alnum(siteName), alnum(host)].filter((b) => b.length >= 3);
  const isStoreText = (part) => {
    const a = alnum(part);
    return !a || MARKETING.test(fold(part).trim()) || brands.some((b) => a.includes(b) || (a.length >= 4 && b.includes(a)));
  };
  let n = String(name ?? '').trim();
  const pipes = n.split(/\s+\|\s+|\s*\|\s*/);
  const cut = pipes.findIndex((p, i) => i > 0 && isStoreText(p));
  if (cut > 0) n = pipes.slice(0, cut).join(' | ');
  for (let i = 0; i < 3; i++) {
    const m = /^(.+?)\s+[-–—·:]\s+([^-–—·:]+)$/.exec(n);
    if (!m || !isStoreText(m[2])) break;
    n = m[1];
  }
  return n.replace(/\s*[-–—·:|]\s*$/, '').trim() || String(name ?? '').trim();
}

/**
 * @param {string} html
 * @param {string} pageUrl URL final da página (para resolver links relativos)
 * @returns {{ name: string, description: string, priceCents: number|null, inStock: boolean|null,
 *            imageUrls: string[], url: string, siteName: string|null, sellerName: string|null,
 *            source: 'json-ld'|'vtex'|'meta' } | null}
 */
export function parseProductPage(html, pageUrl) {
  const ld = fromJsonLd(html, pageUrl);
  const vtex = fromVtexSkuJson(html, pageUrl);
  const og = fromMeta(html);
  // Sem produto declarado em lugar nenhum (artigo, blog, institucional) não é página de produto (BR-STORE-014).
  const metaOnly = og?.productish && og.name ? og : null;
  const base = ld ?? vtex ?? metaOnly;
  if (!base) return null;
  // Completa o que faltou com as fontes seguintes (ex.: só o og:image tem foto).
  const rest = [vtex, og].filter((s) => s && s !== base);
  const first = (key, empty) => [base, ...rest].map((s) => s[key]).find((v) => !empty(v));
  const merged = {
    name: base.name,
    description: first('description', (v) => !v) ?? '',
    priceCents: first('priceCents', (v) => v == null) ?? null,
    inStock: first('inStock', (v) => v == null) ?? null,
    sellerName: first('sellerName', (v) => !v) ?? null,
    imageUrls: first('imageUrls', (v) => !v?.length) ?? [],
  };
  const canonical = /<link[^>]+rel=["']?canonical["']?[^>]*href=["']([^"']+)["']/i.exec(html)?.[1]
    ?? /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']?canonical["']?/i.exec(html)?.[1];
  const absolute = (u) => {
    try {
      const abs = new URL(decodeEntities(u), pageUrl);
      return abs.protocol === 'https:' ? abs.toString() : null;
    } catch {
      return null;
    }
  };
  const seen = new Set();
  const images = merged.imageUrls.map(absolute).filter(Boolean).map(largerImage).filter((u) => {
    const key = imageKey(u);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const siteName = meta(html, 'og:site_name') ?? new URL(pageUrl).hostname.replace(/^www\./, '');
  return {
    name: cleanProductName(merged.name, { siteName, pageUrl }).slice(0, 150),
    description: merged.description.slice(0, 5000),
    priceCents: merged.priceCents,
    inStock: merged.inStock,
    imageUrls: images.slice(0, 6),
    // A variação escolhida tem link próprio; o canonical da página é o do grupo.
    url: (ld?.variantUrl && absolute(ld.variantUrl)) || (absolute(canonical ?? base.url ?? og?.url ?? pageUrl) ?? pageUrl),
    siteName,
    sellerName: merged.sellerName ? merged.sellerName.slice(0, MAX_SELLER_NAME) : null, // BR-STORE-013
    source: ld ? 'json-ld' : vtex ? 'vtex' : 'meta',
  };
}
