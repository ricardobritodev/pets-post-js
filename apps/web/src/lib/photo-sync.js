/**
 * photo-sync.js — Depois de salvar o anúncio: remove as fotos marcadas e envia as novas,
 * uma por requisição. Falha numa foto não desfaz o anúncio (BR-PHOTO-006).
 */
import { api, ApiError } from './api.js';

/**
 * @param {string} basePath rota do anúncio na API, ex.: '/posts/12' ou '/adoption/3'
 * @param {{ newFiles: () => File[], removedIds: () => number[] }} picker
 * @param {(text: string) => void} onProgress
 * @returns {Promise<string[]>} avisos para mostrar
 */
export async function syncPhotos(basePath, picker, onProgress) {
  const problems = [];
  for (const photoId of picker.removedIds()) {
    try {
      await api(`${basePath}/photos/${photoId}`, { method: 'DELETE' });
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) problems.push('Não foi possível remover uma das fotos.');
    }
  }
  const files = picker.newFiles();
  for (const [i, file] of files.entries()) {
    onProgress(`Enviando foto ${i + 1} de ${files.length}…`);
    const body = new FormData();
    body.append('photos', file, file.name);
    try {
      const { rejected } = await api(`${basePath}/photos`, { method: 'POST', body });
      for (const r of rejected) problems.push(`${r.name}: ${r.message}`);
    } catch (err) {
      problems.push(`${file.name}: ${err instanceof ApiError ? err.message : 'falha no envio.'}`);
      if (err instanceof ApiError && err.status === 401) break;
    }
  }
  return problems;
}
