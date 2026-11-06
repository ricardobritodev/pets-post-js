/**
 * post-card.js — Card de post (porta de posts/_card.html, T4.11).
 * Recebe um PostCard da API (specs/api/posts.md).
 */
import { el, formatDate } from './dom.js';
import { icon } from './icons.js';

/** Ícone do placeholder por tipo de animal (desenhos do sistema antigo). */
export const PET_ICON = Object.freeze({ dog: 'dog', cat: 'cat', bird: 'bird', other: 'paw' });

/** Badge de situação: resolvido > perdido/encontrado. */
export function statusBadge(post, { long = false } = {}) {
  if (post.isResolved) return el('span', { class: 'badge-status badge-resolved' }, icon('check', { size: 14 }), long ? 'Resolvido — Pet reencontrado!' : 'Resolvido');
  if (post.status === 'lost') return el('span', { class: 'badge-status badge-lost' }, long ? 'Pet Perdido' : 'Perdido');
  return el('span', { class: 'badge-status badge-found' }, long ? 'Pet Encontrado' : 'Encontrado');
}

/** Foto principal ou um "placeholder" com o emoji do tipo de animal. */
export function petImage(post, className) {
  const alt = `Foto de ${post.petName || post.petTypeLabel}`;
  if (post.primaryPhoto) return el('img', { src: post.primaryPhoto.url, alt, class: className, loading: 'lazy' });
  return el('div', { class: `${className} pet-placeholder`, role: 'img', 'aria-label': alt }, icon(PET_ICON[post.petType] ?? 'paw', { size: 64 }));
}

const shorten = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function renderPostCard(post) {
  const href = `/posts/${post.id}`;
  return el('article', { class: 'pet-card' },
    el('a', { href, class: 'block overflow-hidden', tabindex: '-1', 'aria-hidden': 'true' }, petImage(post, 'pet-card-image')),
    el('div', { class: 'flex flex-1 flex-col gap-2 p-4' },
      el('div', { class: 'flex flex-wrap gap-2' }, statusBadge(post), el('span', { class: 'badge' }, post.petTypeLabel)),
      el('h3', { class: 'font-semibold leading-snug' }, el('a', { href, class: 'hover:text-brand-700' }, post.title)),
      el('p', { class: 'flex items-start gap-1 text-sm text-stone-600' }, icon('map-pin', { size: 16, class: 'mt-0.5' }), shorten(post.lastSeenLocation, 50)),
    ),
    el('div', { class: 'flex items-center justify-between border-t border-stone-100 px-4 py-3' },
      el('time', { datetime: post.createdAt, class: 'text-xs text-stone-500' }, formatDate(post.createdAt)),
      el('a', { href, class: 'btn btn-outline btn-sm' }, 'Ver mais'),
    ),
  );
}

/** Grade de cards ou estado vazio. */
export function renderGrid(posts, empty) {
  if (!posts.length) return empty;
  return el('div', { class: 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3' }, posts.map(renderPostCard));
}
