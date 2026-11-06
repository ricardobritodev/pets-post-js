/**
 * product-card.js — Card de produto da vitrine (specs/api/store.md, ProductCard).
 */
import { formatBRL } from '@petspost/domain/store';
import { el } from './dom.js';
import { icon } from './icons.js';
import { PET_ICON } from './post-card.js';

/** Foto ou placeholder com o ícone do animal (ou a pata, se serve para todos). */
export function productImage(p, className) {
  if (p.primaryPhoto) return el('img', { src: p.primaryPhoto.url, alt: p.name, class: className, loading: 'lazy' });
  return el('div', { class: `${className} pet-placeholder`, role: 'img', 'aria-label': p.name }, icon(PET_ICON[p.petType] ?? 'paw', { size: 56 }));
}

/** BR-STORE-003 — preço "de/por" e o desconto. */
export function priceBlock(p, { large = false } = {}) {
  return el('div', { class: large ? 'price-block price-block-lg' : 'price-block' },
    p.discountPercent != null && el('span', { class: 'price-old' }, formatBRL(p.priceCents)),
    el('span', { class: 'price-final' }, formatBRL(p.finalPriceCents)),
    p.discountPercent != null && el('span', { class: 'price-off' }, `-${p.discountPercent}%`),
  );
}

export function renderProductCard(p) {
  const href = `/loja/produto/${p.id}`;
  return el('article', { class: 'product-card' },
    el('a', { href, class: 'relative block overflow-hidden', tabindex: '-1', 'aria-hidden': 'true' },
      productImage(p, 'product-card-image'),
      el('div', { class: 'absolute left-2 top-2 flex flex-col items-start gap-1' },
        p.isFeatured && el('span', { class: 'product-flag' }, icon('trophy', { size: 12 }), 'Destaque'),
        !p.inStock && el('span', { class: 'product-flag product-flag-muted' }, 'Esgotado'),
      ),
    ),
    el('div', { class: 'flex flex-1 flex-col gap-1 p-3' },
      el('p', { class: 'text-xs text-stone-500' }, `${p.categoryLabel} · ${p.petTypeLabel}`),
      el('h3', { class: 'line-clamp-2 text-sm font-medium leading-snug' }, el('a', { href, class: 'hover:text-brand-700' }, p.name)),
      // BR-STORE-013 — "Vendido e entregue por" (vendedor do produto ou o parceiro)
      p.soldBy && el('p', { class: 'flex items-center gap-1 text-xs text-stone-500' }, icon('shopping-bag', { size: 12, class: 'shrink-0' }),
        el('span', { class: 'line-clamp-1' }, 'Vendido e entregue por ', el('span', { class: 'font-medium text-stone-700' }, p.soldBy))),
      el('div', { class: 'mt-auto pt-2' }, priceBlock(p)),
    ),
  );
}

export function renderProductGrid(items, empty) {
  if (!items.length) return empty;
  return el('div', { class: 'grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4' }, items.map(renderProductCard));
}
