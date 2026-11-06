/**
 * listing-page.js — Página de lista com filtros e paginação sem recarregar (posts e adoção).
 * O estado fica na URL, então dá para compartilhar o link e o botão voltar funciona.
 */
import { api } from './api.js';
import { el } from './dom.js';
import { icon } from './icons.js';

/**
 * @param {{
 *   basePath: string,        // URL da página, ex.: '/posts/'
 *   apiPath: string,         // rota da API, ex.: '/posts'
 *   filters: Array<{ field: string, query: string, api: string, values?: string[] }>,
 *     // field = name do campo no form; query = nome na URL da página; api = nome na API;
 *     // sem `values` = texto livre (ex.: busca)
 *   form: HTMLFormElement, list: HTMLElement, pager: HTMLElement, count: HTMLElement,
 *   clearButton?: HTMLElement,
 *   renderGrid: (items: object[], empty: HTMLElement) => HTMLElement,
 *   empty: (filtered: boolean) => HTMLElement,
 *   countText?: (total: number) => string,
 * }} options
 */
export function createListingPage(options) {
  const { basePath, apiPath, filters, form, list, pager, count, clearButton, renderGrid, empty } = options;
  const countText = options.countText ?? ((n) => (n === 1 ? '1 anúncio encontrado' : `${n} anúncios encontrados`));

  /** Lê a URL. Valores inválidos são ignorados, como na API. */
  function readState() {
    const q = new URLSearchParams(location.search);
    const state = { page: Math.max(1, Number.parseInt(q.get('page'), 10) || 1) };
    for (const f of filters) {
      const value = q.get(f.query) ?? q.get(f.api);
      state[f.field] = f.values ? (f.values.includes(value) ? value : '') : (value ?? '').trim().slice(0, 100);
    }
    return state;
  }

  function toQuery(state) {
    const q = new URLSearchParams();
    for (const f of filters) if (state[f.field]) q.set(f.query, state[f.field]);
    if (state.page > 1) q.set('page', String(state.page));
    const s = q.toString();
    return s ? `?${s}` : '';
  }

  function pageLink(state, page, label, { current = false, disabled = false } = {}) {
    if (disabled) return el('span', { class: 'btn btn-ghost btn-sm opacity-40', 'aria-disabled': 'true' }, label);
    return el('a', {
      href: `${basePath}${toQuery({ ...state, page })}`,
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
    const nums = [];
    for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) {
      nums.push(pageLink(state, p, String(p), { current: p === page }));
    }
    pager.replaceChildren(
      pageLink(state, page - 1, [icon('arrow-left', { size: 16 }), 'Anterior'], { disabled: page <= 1 }),
      ...nums,
      pageLink(state, page + 1, ['Próxima', icon('arrow-right', { size: 16 })], { disabled: page >= totalPages }),
    );
  }

  let requestId = 0;
  async function load(state) {
    const mine = ++requestId; // ignora respostas antigas se o usuário trocar o filtro rápido
    for (const f of filters) form.elements[f.field].value = state[f.field];
    list.setAttribute('aria-busy', 'true');
    try {
      const q = new URLSearchParams({ page: String(state.page) });
      for (const f of filters) if (state[f.field]) q.set(f.api, state[f.field]);
      const result = await api(`${apiPath}?${q}`);
      if (mine !== requestId) return;
      list.replaceChildren(renderGrid(result.items, empty(filters.some((f) => state[f.field]))));
      count.textContent = countText(result.total);
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
    history.pushState(null, '', `${basePath}${toQuery(state)}`);
    load(state);
  }

  const fromForm = () => Object.fromEntries([...filters.map((f) => [f.field, form.elements[f.field].value]), ['page', 1]]);
  const cleared = () => Object.fromEntries([...filters.map((f) => [f.field, '']), ['page', 1]]);

  form.addEventListener('change', () => navigate(fromForm()));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    navigate(fromForm());
  });
  clearButton?.addEventListener('click', () => navigate(cleared()));
  window.addEventListener('popstate', () => load(readState()));

  return {
    start: () => load(readState()),
    /** Troca alguns filtros (ex.: atalho de categoria) e volta para a página 1. */
    set: (changes) => navigate({ ...fromForm(), ...changes, page: 1 }),
  };
}

/** Estado vazio padrão das listas. */
export const emptyState = (title, text) =>
  el('div', { class: 'card text-center' },
    el('div', { class: 'text-brand-600' }, icon('search', { size: 48, class: 'mx-auto' })),
    el('h2', { class: 'mt-3 text-lg font-semibold' }, title),
    el('p', { class: 'mt-1 text-stone-600' }, text),
  );
