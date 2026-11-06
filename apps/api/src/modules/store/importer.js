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

/** Decodifica o HTML pelo charset do cabeçalho (utf-8 se não disser). */
function decodeHtml(body, contentType) {
  const charset = /charset=([\w-]+)/i.exec(contentType)?.[1]?.toLowerCase() ?? 'utf-8';
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder('utf-8').decode(body);
  }
}

/** @param {{ fetcher: ReturnType<typeof import('../../lib/safe-fetch.js').createSafeFetcher> }} deps */
export function createProductImporter({ fetcher }) {
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
    const res = await fetchOrExplain(url);
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

  /** Baixa uma foto; devolve { originalname, buffer } ou lança ImportError com motivo. */
  async function downloadImage(url) {
    const res = await fetchOrExplain(url, { maxBytes: PHOTO_POLICY.maxRequestBytes, accept: 'image/avif,image/webp,image/png,image/jpeg,image/*' });
    const type = res.contentType.split(';')[0].trim();
    if (res.status >= 400) throw importFailed(`a foto respondeu ${res.status}`);
    if (!IMAGE_TYPES[type]) throw importFailed('não é uma imagem em formato aceito');
    return { originalname: `foto-importada.${IMAGE_TYPES[type]}`, buffer: res.body };
  }

  return {
    /** BR-STORE-009 — rascunho para o formulário + miniaturas (data:) das fotos. */
    async draft(url) {
      const p = await readPage(url);
      const images = [];
      for (const imageUrl of p.imageUrls) {
        try {
          const { buffer } = await downloadImage(imageUrl);
          const thumb = await sharp(buffer, { limitInputPixels: PHOTO_POLICY.maxPixels }).rotate()
            .resize({ width: 160, height: 160, fit: 'inside' }).flatten({ background: '#ffffff' }).jpeg({ quality: 70 }).toBuffer();
          images.push({ url: imageUrl, thumb: `data:image/jpeg;base64,${thumb.toString('base64')}` });
        } catch { /* foto que não abre não entra na lista */ }
      }
      const warnings = [];
      if (p.priceCents == null) warnings.push('Não encontrei o preço na página: preencha à mão.');
      if (p.inStock === false) warnings.push('A loja informa que o produto está esgotado.');
      if (!images.length) warnings.push('Não consegui pegar fotos desta página: envie à mão, se quiser.');
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
        },
        images,
        warnings,
      };
    },

    /** Lê a página de novo (para "Atualizar do link"). */
    readPage,

    /** Baixa várias fotos; as que falham vão para `rejected` (mesmo formato do envio de fotos). */
    async downloadImages(urls) {
      const files = [];
      const rejected = [];
      for (const url of urls) {
        try {
          files.push(await downloadImage(url));
        } catch (err) {
          rejected.push({ name: url.split('/').pop()?.slice(0, 80) || url, message: `Não consegui baixar: ${err.message}` });
        }
      }
      return { files, rejected };
    },
  };
}
