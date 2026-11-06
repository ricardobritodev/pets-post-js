/**
 * Lista /adocao/ — filtro por tipo + paginação (BR-ADOPT-002). Mesma base da lista de posts.
 */
import '../styles/main.css';
import { mountLayout } from '../lib/layout.js';
import { renderAdoptionGrid } from '../lib/post-card.js';
import { createListingPage, emptyState } from '../lib/listing-page.js';

const page = createListingPage({
  basePath: '/adocao/',
  apiPath: '/adoption',
  filters: [{ field: 'pet_type', query: 'pet_type', api: 'petType', values: ['dog', 'cat', 'bird', 'other'] }],
  form: document.getElementById('filters'),
  list: document.getElementById('adoption-list'),
  pager: document.getElementById('pagination'),
  count: document.getElementById('result-count'),
  clearButton: document.getElementById('clear-filters'),
  renderGrid: renderAdoptionGrid,
  countText: (n) => (n === 1 ? '1 pet esperando um lar' : `${n} pets esperando um lar`),
  empty: (filtered) => filtered
    ? emptyState('Nenhum pet desse tipo para adoção agora', 'Tente outro tipo ou limpe o filtro.')
    : emptyState('Nenhum pet para adoção agora', 'Tem um pet precisando de lar? Publique um anúncio.'),
});

mountLayout();
page.start();
