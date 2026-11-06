/**
 * Lista /posts/ — filtros + paginação sem recarregar (BR-POST-002/003, T4.13).
 * O estado fica na URL (?status=&pet_type=&page=), então dá para compartilhar e voltar.
 */
import '../styles/main.css';
import { mountLayout } from '../lib/layout.js';
import { renderGrid } from '../lib/post-card.js';
import { createListingPage, emptyState } from '../lib/listing-page.js';

const page = createListingPage({
  basePath: '/posts/',
  apiPath: '/posts',
  filters: [
    { field: 'status', query: 'status', api: 'status', values: ['lost', 'found'] },
    { field: 'pet_type', query: 'pet_type', api: 'petType', values: ['dog', 'cat', 'bird', 'other'] },
  ],
  form: document.getElementById('filters'),
  list: document.getElementById('posts-list'),
  pager: document.getElementById('pagination'),
  count: document.getElementById('result-count'),
  clearButton: document.getElementById('clear-filters'),
  renderGrid,
  empty: (filtered) => filtered
    ? emptyState('Nenhum anúncio com esses filtros', 'Tente outra combinação ou limpe os filtros.')
    : emptyState('Nenhum anúncio ainda', 'Seja o primeiro a publicar um anúncio!'),
});

mountLayout();
page.start();
