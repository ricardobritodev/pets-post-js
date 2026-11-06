/**
 * Lista /posts/ — filtros + paginação sem recarregar (BR-POST-002/003, T4.13).
 * O estado fica na URL (?status=&pet_type=&page=), então dá para compartilhar e voltar.
 */
import '../styles/main.css';
import { api } from '../lib/api.js';
import { mountLayout } from '../lib/layout.js';
import { el } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { renderGrid } from '../lib/post-card.js';

const form = document.getElementById('filters');
const list = document.getElementById('posts-list');
const pager = document.getElementById('pagination');
const count = document.getElementById('result-count');

const STATUS = ['lost', 'found'];
const TYPES = ['dog', 'cat', 'bird', 'other'];

/** Lê a URL. Valores inválidos são ignorados, como na API. */
function readState() {
  const q = new URLSearchParams(location.search);
  const page = Number.parseInt(q.get('page'), 10);
  return {
    status: STATUS.includes(q.get('status')) ? q.get('status') : '',
    petType: TYPES.includes(q.get('pet_type') ?? q.get('petType')) ? (q.get('pet_type') ?? q.get('petType')) : '',
    page: page > 0 ? page : 1,
  };
}

function toQuery({ status, petType, page }) {
  const q = new URLSearchParams();
  if (status) q.set('status', status);
  if (petType) q.set('pet_type', petType);
  if (page > 1) q.set('page', String(page));
  const s = q.toString();
  return s ? `?${s}` : '';
}

function pageLink(state, page, label, { current = false, disabled = false } = {}) {
  if (disabled) return el('span', { class: 'btn btn-ghost btn-sm opacity-40', 'aria-disabled': 'true' }, label);
  return el('a', {
    href: `/posts/${toQuery({ ...state, page })}`,
    class: `btn btn-sm ${current ? 'btn-primary' : 'btn-ghost'}`,
    'aria-current': current ? 'page' : null,
    onclick: (e) => {
      e.preventDefault();
      navigate({ ...state, page });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  }, label);
}

function renderPager(state, { page, totalPages }) {
  if (totalPages <= 1) return pager.replaceChildren();
  const from = Math.max(1, page - 2);
  const to = Math.min(totalPages, page + 2);
  const nums = [];
  for (let p = from; p <= to; p++) nums.push(pageLink(state, p, String(p), { current: p === page }));
  pager.replaceChildren(
    pageLink(state, page - 1, [icon('arrow-left', { size: 16 }), 'Anterior'], { disabled: page <= 1 }),
    ...nums,
    pageLink(state, page + 1, ['Próxima', icon('arrow-right', { size: 16 })], { disabled: page >= totalPages }),
  );
}

const empty = (filtered) =>
  el('div', { class: 'card text-center' },
    el('div', { class: 'text-brand-600' }, icon('search', { size: 48, class: 'mx-auto' })),
    el('h2', { class: 'mt-3 text-lg font-semibold' }, filtered ? 'Nenhum anúncio com esses filtros' : 'Nenhum anúncio ainda'),
    el('p', { class: 'mt-1 text-stone-600' },
      filtered ? 'Tente outra combinação ou limpe os filtros.' : 'Seja o primeiro a publicar um anúncio!'),
  );

let requestId = 0;
async function load(state) {
  const mine = ++requestId; // ignora respostas antigas se o usuário trocar o filtro rápido
  form.status.value = state.status;
  form.pet_type.value = state.petType;
  list.setAttribute('aria-busy', 'true');
  try {
    const q = new URLSearchParams({ page: String(state.page) });
    if (state.status) q.set('status', state.status);
    if (state.petType) q.set('petType', state.petType);
    const result = await api(`/posts?${q}`);
    if (mine !== requestId) return;
    list.replaceChildren(renderGrid(result.items, empty(Boolean(state.status || state.petType))));
    count.textContent = result.total === 1 ? '1 anúncio encontrado' : `${result.total} anúncios encontrados`;
    renderPager(state, result);
  } catch {
    if (mine !== requestId) return;
    count.textContent = '';
    pager.replaceChildren();
    list.replaceChildren(
      el('div', { class: 'card text-center' },
        el('p', { class: 'text-stone-600' }, 'Não foi possível carregar os anúncios agora.'),
        el('button', { type: 'button', class: 'btn btn-outline mt-4', onclick: () => load(state) }, 'Tentar de novo'),
      ),
    );
  } finally {
    if (mine === requestId) list.setAttribute('aria-busy', 'false');
  }
}

function navigate(state) {
  history.pushState(null, '', `/posts/${toQuery(state)}`);
  load(state);
}

form.addEventListener('change', () => navigate({ status: form.status.value, petType: form.pet_type.value, page: 1 }));
document.getElementById('clear-filters').addEventListener('click', () => navigate({ status: '', petType: '', page: 1 }));
window.addEventListener('popstate', () => load(readState()));

mountLayout();
load(readState());
