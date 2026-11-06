/**
 * browser-images.js — BR-STORE-015: quando a loja limita o servidor do Pets Post (429), o navegador do admin
 * baixa as fotos (é uma pessoa vendo a foto). Só de servidores da lista (`BROWSER_IMAGE_HOSTS`, liberados na
 * CSP das páginas /admin), sem cookies, só imagem até 8 MB. Ao salvar, vão pelo envio normal de fotos.
 */
import { browserCanFetchImage } from '@petspost/domain/store';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
const MAX_BYTES = 8 * 1024 * 1024;

/** Baixa a foto e devolve um File pronto para o envio; lança se não der. */
export async function downloadInBrowser(url, index = 0) {
  if (!browserCanFetchImage(url)) throw new Error('servidor de fotos fora da lista');
  const res = await fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!res.ok) throw new Error(`a foto respondeu ${res.status}`);
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!TYPES[type]) throw new Error('não é uma imagem em formato aceito');
  const blob = await res.blob();
  if (blob.size > MAX_BYTES) throw new Error('foto grande demais');
  return new File([blob], `foto-da-loja-${index + 1}.${TYPES[type]}`, { type });
}

/** Baixa várias; devolve as que vieram e quantas falharam. */
export async function downloadAllInBrowser(urls) {
  const files = [];
  let failed = 0;
  for (const [i, url] of urls.entries()) {
    try {
      files.push({ url, file: await downloadInBrowser(url, i) });
    } catch {
      failed++;
    }
  }
  return { files, failed };
}
