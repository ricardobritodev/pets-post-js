/**
 * importer.js — Importa produto de um link (BR-STORE-009/010): busca segura + leitura da página.
 */
import sharp from 'sharp';
import { suggestCategory, suggestPetType, PHOTO_POLICY } from '@petspost/domain';
import { HttpError } from '../../middleware/errors.js';
import { SafeFetchError } from '../../lib/safe-fetch.js';
import { parseProductPage } from '../../lib/product-page.js';

/** 422 IMPORT_FAILED — o produto/foto não pôde ser lido; o admin preenche à mão. */
export const importFailed = (message) => new HttpError(422, 'IMPORT_FAILED', message);

const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'o site';
  }
};

/** Fotos baixadas no rascunho ficam guardadas para o "salvar" não pedir de novo (BR-STORE-010). */
const IMAGE_CACHE_MS = 15 * 60 * 1000;
const IMAGE_CACHE_MAX_BYTES = 64 * 1024 * 1024;

/** O site limitou robôs (429): não adianta pedir as outras fotos agora. */
const rateLimited = (host) => Object.assign(
  importFailed(`o site ${host} limitou o acesso de robôs às fotos agora (429). Tente de novo em alguns minutos ou envie as fotos à mão`),
  { rateLimited: true },
);

/** "https://cdn/x/Foto%20Frente.webp?v=1" → "Foto Frente.webp" (para a mensagem de foto recusada). */
function fileNameOf(url) {
  const last = String(url).split('?')[0].split('/').pop() ?? '';
  try {
    return decodeURIComponent(last).slice(0, 80) || url;
  } catch {
    return last.slice(0, 80) || url;
  }
}

/**
 * Decodifica o HTML: charset do cabeçalho → do `<meta charset>`/http-equiv da própria página (BR-STORE-014) → utf-8.
 */
export function decodeHtml(body, contentType) {
  const head = body.subarray(0, 4096).toString('latin1');
  const charset = (/charset=["']?([\w-]+)/i.exec(contentType)?.[1]
    ?? /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1]
    ?? 'utf-8').toLowerCase();
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder('utf-8').decode(body);
  }
}

/**
 * @param {{ fetcher: ReturnType<typeof import('../../lib/safe-fetch.js').createSafeFetcher>, now?: () => number }} deps
 */
export function createProductImporter({ fetcher, now = Date.now }) {
  /** url → { file, expires }. Map mantém a ordem de inserção: o mais antigo sai primeiro. */
  const imageCache = new Map();
  let cachedBytes = 0;
  const forget = (url) => {
    const entry = imageCache.get(url);
    if (!entry) return;
    cachedBytes -= entry.file.buffer.length;
    imageCache.delete(url);
  };
  const remember = (url, file) => {
    forget(url);
    imageCache.set(url, { file, expires: now() + IMAGE_CACHE_MS });
    cachedBytes += file.buffer.length;
    while (cachedBytes > IMAGE_CACHE_MAX_BYTES && imageCache.size) forget(imageCache.keys().next().value);
  };
  const recall = (url) => {
    const entry = imageCache.get(url);
    if (entry && entry.expires > now()) return entry.file;
    forget(url);
    return null;
  };

  /** Erros da busca → mensagem para o admin. Link inválido é 400 (erro de quem digitou). */
  async function fetchOrExplain(url, options) {
    try {
      return await fetcher.fetchUrl(url, options);
    } catch (err) {
      if (err instanceof SafeFetchError) {
        if (err.code === 'INVALID_URL') {
          throw new HttpError(400, 'VALIDATION_ERROR', err.message, [{ path: 'url', message: err.message }]);
        }
        throw importFailed(err.code === 'BLOCKED_ADDRESS' ? 'Esse endereço não é permitido.' : err.message);
      }
      throw err;
    }
  }

  async function readPage(url) {
    const res = await fetchOrExplain(url, { truncate: true }); // página grande: os dados ficam no começo
    const host = hostOf(res.url);
    if ([401, 403, 429, 503].includes(res.status)) {
      throw importFailed(`O site ${host} não permite leitura automática (respondeu ${res.status}). Preencha os dados à mão.`);
    }
    if (res.status >= 400) throw importFailed(`O site ${host} respondeu com erro ${res.status}. Confira o link.`);
    if (!/text\/html|application\/xhtml/.test(res.contentType)) throw importFailed('Esse link não é uma página de produto.');
    const product = parseProductPage(decodeHtml(res.body, res.contentType), res.url);
    if (!product) throw importFailed(`Não encontrei os dados do produto em ${host}. Preencha os dados à mão.`);
    return product;
  }

  /** Baixa uma foto (ou pega a guardada); devolve { originalname, buffer } ou lança com o motivo. */
  async function downloadImage(url) {
    const cached = recall(url);
    if (cached) return cached;
    const res = await fetchOrExplain(url, { maxBytes: PHOTO_POLICY.maxRequestBytes, accept: 'image/avif,image/webp,image/png,image/jpeg,image/*' });
    const type = res.contentType.split(';')[0].trim();
    if (res.status === 429) throw rateLimited(hostOf(url));
    if (res.status >= 400) throw importFailed(`a foto respondeu ${res.status}`);
    if (!IMAGE_TYPES[type]) throw importFailed('não é uma imagem em formato aceito');
    const file = { originalname: `foto-importada.${IMAGE_TYPES[type]}`, buffer: res.body };
    remember(url, file);
    return file;
  }

  return {
    /** BR-STORE-009 — rascunho para o formulário + miniaturas (data:) das fotos. */
    async draft(url) {
      const p = await readPage(url);
      const images = [];
      let limited = false;
      for (const imageUrl of p.imageUrls) {
        try {
          const { buffer } = await downloadImage(imageUrl);
          const thumb = await sharp(buffer, { limitInputPixels: PHOTO_POLICY.maxPixels }).rotate()
            .resize({ width: 160, height: 160, fit: 'inside' }).flatten({ background: '#ffffff' }).jpeg({ quality: 70 }).toBuffer();
          images.push({ url: imageUrl, thumb: `data:image/jpeg;base64,${thumb.toString('base64')}` });
        } catch (err) {
          // foto que não abre não entra na lista; 429 = parar de pedir (BR-STORE-010)
          if (err.rateLimited) {
            limited = true;
            break;
          }
        }
      }
      const warnings = [];
      if (p.priceCents == null) warnings.push('Não encontrei o preço na página: preencha à mão.');
      if (p.inStock === false) warnings.push('A loja informa que o produto está esgotado.');
      if (limited) {
        warnings.push(`O site ${hostOf(p.url ?? url)} limitou o acesso de robôs às fotos agora (429)${images.length ? ' e algumas fotos ficaram de fora' : ''}. `
          + 'Tente buscar de novo em alguns minutos ou envie as fotos à mão.');
      } else if (!images.length) warnings.push('Não consegui pegar fotos desta página: envie à mão, se quiser.');
      const text = `${p.name} ${p.description}`;
      return {
        draft: {
          name: p.name,
          description: p.description,
          priceCents: p.priceCents,
          inStock: p.inStock,
          url: p.url,
          category: suggestCategory(p.name) ?? suggestCategory(text),
          petType: suggestPetType(p.name) ?? suggestPetType(text),
          siteName: p.siteName,
          sellerName: p.sellerName, // BR-STORE-013
        },
        images,
        warnings,
      };
    },

    /** Lê a página de novo (para "Atualizar do link"). */
    readPage,

    /**
     * Baixa várias fotos (as do rascunho já vêm guardadas); as que falham vão para `rejected`
     * (mesmo formato do envio de fotos). Depois de um 429, não pede as seguintes.
     */
    async downloadImages(urls) {
      const files = [];
      const rejected = [];
      let limited = null;
      for (const url of urls) {
        const name = fileNameOf(url);
        const cached = recall(url);
        if (cached) {
          files.push(cached);
          continue;
        }
        if (limited) {
          rejected.push({ name, message: `Não consegui baixar: ${limited.message}` });
          continue;
        }
        try {
          files.push(await downloadImage(url));
        } catch (err) {
          if (err.rateLimited) limited = err;
          rejected.push({ name, message: `Não consegui baixar: ${err.message}` });
        }
      }
      return { files, rejected };
    },
  };
}
