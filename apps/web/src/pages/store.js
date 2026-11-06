/**
 * Vitrine /loja — BR-STORE-001..004. Estado na URL (?q=&category=&pet_type=&sort=&page=).
 */
import '../styles/main.css';
import { api } from '../lib/api.js';
import { mountLayout } from '../lib/layout.js';
import { el } from '../lib/dom.js';
import { createListingPage, emptyState } from '../lib/listing-page.js';
import { renderProductGrid } from '../lib/product-card.js';

const CATEGORIES = ['food', 'treats', 'toys', 'hygiene', 'health', 'accessories', 'beds'];
const chips = document.getElementById('category-chips');

const page = createListingPage({
  basePath: '/loja',
  apiPath: '/store/products',
  filters: [
    { field: 'q', query: 'q', api: 'q' },
    { field: 'category', query: 'category', api: 'category', values: CATEGORIES },
    { field: 'pet_type', query: 'pet_type', api: 'petType', values: ['dog', 'cat', 'bird', 'other'] },
    { field: 'sort', query: 'sort', api: 'sort', values: ['price_asc', 'price_desc', 'newest'] },
    { field: 'partner', query: 'partner', api: 'partnerId' }, // "Mais produtos" do parceiro
  ],
  form: document.getElementById('filters'),
  list: document.getElementById('products'),
  pager: document.getElementById('pagination'),
  count: document.getElementById('result-count'),
  clearButton: document.getElementById('clear-filters'),
  renderGrid: (items, empty) => {
    markChip();
    return renderProductGrid(items, empty);
  },
  countText: (n) => (n === 1 ? '1 produto' : `${n} produtos`),
  empty: (filtered) => filtered
    ? emptyState('Nenhum produto com esses filtros', 'Tente outra busca ou limpe os filtros.')
    : emptyState('A loja ainda está vazia', 'Os produtos dos parceiros aparecem aqui assim que forem cadastrados.'),
});

/** Atalhos de categoria (com quantos produtos cada uma tem). */
function markChip() {
  const current = document.getElementById('category').value;
  for (const b of chips.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.value === current));
}

async function loadChips() {
  try {
    const { items } = await api('/store/categories');
    chips.replaceChildren(
      el('button', { type: 'button', class: 'chip shrink-0', 'data-value': '', onclick: () => page.set({ category: '' }) }, 'Tudo'),
      ...items.filter((c) => c.count > 0).map((c) =>
        el('button', { type: 'button', class: 'chip shrink-0', 'data-value': c.value, onclick: () => page.set({ category: c.value }) },
          c.label, el('span', { class: 'text-xs text-stone-400' }, String(c.count)))),
    );
    markChip();
  } catch {
    chips.remove();
  }
}

mountLayout();
loadChips();
page.start();
