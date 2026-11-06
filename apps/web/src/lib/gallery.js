/**
 * gallery.js — Galeria do detalhe (posts e adoção): foto principal + miniaturas.
 * Recebe qualquer anúncio com { photos, primaryPhoto, petName, petTypeLabel, petType }.
 */
import { el } from './dom.js';
import { petImage } from './post-card.js';

export function gallery(item) {
  if (item.photos.length === 0) return petImage(item, 'gallery-main');
  const primary = item.photos.find((p) => p.url === item.primaryPhoto?.url) ?? item.photos[0];
  const name = item.petName || item.petTypeLabel;
  const main = el('img', { src: primary.url, alt: `Foto de ${name}`, class: 'gallery-main' });
  if (item.photos.length === 1) return main;
  const thumbs = item.photos.map((photo, i) =>
    el('button', {
      type: 'button',
      class: 'gallery-thumb',
      'aria-label': `Ver foto ${i + 1}`,
      'aria-pressed': String(photo === primary),
      onclick: (e) => {
        main.src = photo.url;
        e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        e.currentTarget.setAttribute('aria-pressed', 'true');
      },
    }, el('img', { src: photo.url, alt: `Foto ${i + 1} de ${name}`, loading: 'lazy' })),
  );
  return el('div', {}, main, el('div', { class: 'mt-3 flex flex-wrap gap-2' }, thumbs));
}
