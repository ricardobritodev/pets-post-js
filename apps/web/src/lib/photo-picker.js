/**
 * photo-picker.js — Escolha de fotos no formulário (porta do initPhotoUpload do main.js antigo).
 *   - arrastar e soltar ou clicar para escolher;
 *   - prévia antes de enviar, com botão de tirar;
 *   - na edição, marcar fotos já salvas para excluir (com "desfazer");
 *   - respeita o limite de 6 (BR-PHOTO-001) e as extensões aceitas (BR-PHOTO-003).
 * Quem decide de verdade é o servidor; aqui é só para avisar cedo.
 */
import { PHOTO_POLICY } from '@petspost/domain/constants';
import { el } from './dom.js';

/** Cada foto vai numa requisição própria, então o limite de 8 MB vale por arquivo (com folga para o multipart). */
export const MAX_FILE_BYTES = PHOTO_POLICY.maxRequestBytes - 16 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';

const extOf = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');

/** Motivo para recusar o arquivo no navegador, ou null se está ok. */
export function checkFile(file) {
  if (!PHOTO_POLICY.allowedExtensions.includes(extOf(file.name))) return 'formato não aceito (use PNG, JPG, GIF ou WEBP)';
  if (file.size > MAX_FILE_BYTES) return 'passa de 8 MB';
  return null;
}

/**
 * @param {HTMLElement} root onde o seletor é desenhado
 * @param {{ existing?: Array<{ id: number, url: string, isPrimary: boolean }> }} [options]
 */
export function createPhotoPicker(root, { existing = [] } = {}) {
  const max = PHOTO_POLICY.maxPerPost;
  const kept = existing.map((p) => ({ ...p, removed: false }));
  /** @type {Array<{ file: File, url: string }>} */
  const added = [];

  const activeCount = () => kept.filter((p) => !p.removed).length + added.length;

  const input = el('input', { type: 'file', id: 'photos', accept: ACCEPT, multiple: true, class: 'sr-only' });
  const zone = el('label', { class: 'upload-zone' },
    input,
    el('span', { class: 'text-3xl', 'aria-hidden': 'true' }, '📷'),
    el('span', { class: 'font-medium' }, 'Arraste as fotos aqui ou clique para escolher'),
    el('span', { class: 'text-sm text-stone-500' }, `Até ${max} fotos · PNG, JPG, GIF ou WEBP · até 8 MB cada`),
  );
  const counter = el('p', { class: 'text-sm text-stone-500', 'aria-live': 'polite' });
  const errors = el('ul', { class: 'field-error space-y-1', role: 'alert' });
  const grid = el('ul', { class: 'grid grid-cols-3 gap-3 sm:grid-cols-6', 'aria-label': 'Fotos do anúncio' });

  function addFiles(fileList) {
    const problems = [];
    for (const file of fileList) {
      const reason = checkFile(file);
      if (reason) problems.push(`${file.name}: ${reason}.`);
      else if (activeCount() >= max) problems.push(`${file.name}: limite de ${max} fotos por anúncio.`);
      else added.push({ file, url: URL.createObjectURL(file) });
    }
    errors.replaceChildren(...problems.map((m) => el('li', {}, m)));
    render();
  }

  /** A principal é a 1ª salva que sobra; se nenhuma sobra, a 1ª nova (BR-PHOTO-002). */
  function primaryKey() {
    const old = kept.find((p) => !p.removed && p.isPrimary) ?? kept.find((p) => !p.removed);
    if (old) return `old-${old.id}`;
    return added[0] ? `new-${added[0].url}` : null;
  }

  function tile({ key, url, alt, removed, action }) {
    return el('li', { class: `photo-tile${removed ? ' is-removed' : ''}` },
      el('img', { src: url, alt }),
      key === primaryKey() && el('span', { class: 'photo-badge' }, 'Principal'),
      removed && el('span', { class: 'photo-badge photo-badge-danger' }, 'Será removida'),
      action,
    );
  }

  function render() {
    const tiles = [
      ...kept.map((p, i) =>
        tile({
          key: `old-${p.id}`,
          url: p.url,
          alt: `Foto salva ${i + 1}`,
          removed: p.removed,
          action: el('button', {
            type: 'button',
            class: 'photo-action',
            'aria-label': p.removed ? `Manter a foto salva ${i + 1}` : `Remover a foto salva ${i + 1}`,
            onclick: () => {
              if (p.removed && activeCount() >= max) {
                errors.replaceChildren(el('li', {}, `Limite de ${max} fotos: tire uma foto nova antes.`));
                return;
              }
              p.removed = !p.removed;
              render();
            },
          }, p.removed ? '↺' : '×'),
        })),
      ...added.map((a, i) =>
        tile({
          key: `new-${a.url}`,
          url: a.url,
          alt: `Foto nova ${i + 1}: ${a.file.name}`,
          action: el('button', {
            type: 'button',
            class: 'photo-action',
            'aria-label': `Tirar a foto ${a.file.name}`,
            onclick: () => {
              URL.revokeObjectURL(a.url);
              added.splice(added.indexOf(a), 1);
              render();
            },
          }, '×'),
        })),
    ];
    grid.replaceChildren(...tiles);
    grid.hidden = tiles.length === 0;
    const count = activeCount();
    counter.textContent = `${count} de ${max} fotos${count >= max ? ' (limite atingido)' : ''}`;
    zone.classList.toggle('is-full', count >= max);
  }

  input.addEventListener('change', () => {
    addFiles(input.files);
    input.value = ''; // deixa escolher o mesmo arquivo de novo
  });
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('is-dragging');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-dragging'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('is-dragging');
    addFiles(e.dataTransfer.files);
  });

  root.replaceChildren(zone, counter, errors, grid);
  render();

  return {
    newFiles: () => added.map((a) => a.file),
    removedIds: () => kept.filter((p) => p.removed).map((p) => p.id),
  };
}
