/**
 * admin.js — Base das páginas do painel (specs/api/admin.md).
 * A checagem de papel aqui é só para mostrar a mensagem certa; quem protege é a API (PERM-003).
 */
import { api, ApiError } from './api.js';
import { mountLayout, showFlash } from './layout.js';
import { redirectToLogin } from './session.js';
import { el, formatDate } from './dom.js';
import { icon } from './icons.js';

const TABS = [
  { href: '/admin', label: 'Dashboard', iconName: 'cog' },
  { href: '/admin/usuarios', label: 'Usuários', iconName: 'user' },
  { href: '/admin/posts', label: 'Posts', iconName: 'megaphone' },
  { href: '/admin/adocao', label: 'Adoção', iconName: 'home' },
  { href: '/admin/parceiros', label: 'Parceiros', iconName: 'building-plus' },
];

const isCurrentTab = (href) =>
  href === '/admin' ? /^\/admin\/?$/.test(location.pathname) : location.pathname.startsWith(href);

/** Monta layout + menu do admin. Devolve o usuário, ou null se não puder ver a página. */
export async function mountAdmin() {
  const user = await mountLayout();
  const root = document.getElementById('admin-root');
  if (!user) {
    redirectToLogin();
    return null;
  }
  if (user.role !== 'admin') {
    root.replaceChildren(
      el('div', { class: 'card mx-auto max-w-lg text-center' },
        el('div', { class: 'text-brand-600' }, icon('lock', { size: 48, class: 'mx-auto' })),
        el('h1', { class: 'mt-3 text-xl font-bold' }, 'Acesso restrito'),
        el('p', { class: 'mt-1 text-stone-600' }, 'Esta área é só para administradores.'),
        el('a', { href: '/', class: 'btn btn-primary mt-5' }, 'Voltar para o início'),
      ),
    );
    return null;
  }
  document.getElementById('admin-tabs')?.replaceChildren(
    el('nav', { class: 'admin-tabs', 'aria-label': 'Painel administrativo' },
      ...TABS.map((t) => el('a', { href: t.href, class: 'admin-tab', ...(isCurrentTab(t.href) && { 'aria-current': 'page' }) },
        icon(t.iconName, { size: 16 }), t.label)),
    ),
  );
  root.hidden = false;
  return user;
}

/** Chama a API e mostra o erro como mensagem. Devolve o corpo, ou undefined se falhou. */
export async function adminCall(path, options) {
  try {
    return await api(path, options);
  } catch (err) {
    showFlash(err instanceof ApiError ? err.message : 'Sem conexão com o servidor.', 'danger');
    return undefined;
  }
}

export const statusPill = (ok, yes, no) => el('span', { class: `badge-status ${ok ? 'badge-found' : 'badge-lost'}` }, ok ? yes : no);
export const dateCell = (iso) => el('time', { datetime: iso, class: 'whitespace-nowrap text-stone-500' }, formatDate(iso));

/**
 * Tabela paginada com busca e filtros. Estado na URL (?q=&page=&...), recarrega sem sair da página.
 * @param {{
 *   apiPath: string,
 *   filters?: Array<{ name: string, label: string, options: Array<[string, string]> }>,
 *   searchLabel: string,
 *   columns: Array<{ label: string, cell: (item: object) => Node|string|null, class?: string }>,
 *   empty: string,
 * }} o
 */
export function createAdminTable(o) {
  const filters = o.filters ?? [];
  const container = document.getElementById('admin-table');
  const toolbar = el('form', { class: 'admin-toolbar', role: 'search', onsubmit: (e) => { e.preventDefault(); go({ page: 1 }); } });
  const search = el('input', { type: 'search', name: 'q', class: 'input', placeholder: o.searchLabel, 'aria-label': o.searchLabel, maxlength: '100' });
  const selects = filters.map((f) =>
    el('select', { name: f.name, class: 'input sm:max-w-48', 'aria-label': f.label, onchange: () => go({ page: 1 }) },
      el('option', { value: '' }, f.label), ...f.options.map(([value, text]) => el('option', { value }, text))));
  toolbar.append(search, ...selects, el('button', { type: 'submit', class: 'btn btn-outline' }, icon('search', { size: 16 }), 'Buscar'));
  const info = el('p', { class: 'text-sm text-stone-500', 'aria-live': 'polite' });
  const tableBox = el('div', { class: 'admin-table-box' });
  const pager = el('nav', { class: 'mt-4 flex items-center justify-center gap-2', 'aria-label': 'Paginação' });
  container.replaceChildren(toolbar, info, tableBox, pager);

  let page = Math.max(1, Number.parseInt(new URLSearchParams(location.search).get('page'), 10) || 1);
  const initial = new URLSearchParams(location.search);
  search.value = initial.get('q') ?? '';
  for (const s of selects) s.value = initial.get(s.name) ?? '';

  function query() {
    const q = new URLSearchParams();
    if (search.value.trim()) q.set('q', search.value.trim());
    for (const s of selects) if (s.value) q.set(s.name, s.value);
    if (page > 1) q.set('page', String(page));
    return q;
  }

  async function load() {
    const q = query();
    tableBox.setAttribute('aria-busy', 'true');
    const body = await adminCall(`${o.apiPath}${q.size ? `?${q}` : ''}`);
    tableBox.setAttribute('aria-busy', 'false');
    if (!body) return;
    info.textContent = body.total === 1 ? '1 resultado' : `${body.total} resultados`;
    if (!body.items.length) {
      tableBox.replaceChildren(el('p', { class: 'card text-center text-stone-600' }, o.empty));
    } else {
      tableBox.replaceChildren(
        el('table', { class: 'admin-table' },
          el('thead', {}, el('tr', {}, ...o.columns.map((c) => el('th', { scope: 'col', class: c.class ?? '' }, c.label)))),
          el('tbody', {}, ...body.items.map((item) =>
            el('tr', {}, ...o.columns.map((c) => el('td', { class: c.class ?? '' }, c.cell(item)))))),
        ),
      );
    }
    pager.replaceChildren(
      el('button', { type: 'button', class: 'btn btn-ghost btn-sm', disabled: body.page <= 1, onclick: () => go({ page: body.page - 1 }) },
        icon('arrow-left', { size: 16 }), 'Anterior'),
      el('span', { class: 'text-sm text-stone-500' }, `Página ${body.page} de ${body.totalPages}`),
      el('button', { type: 'button', class: 'btn btn-ghost btn-sm', disabled: body.page >= body.totalPages, onclick: () => go({ page: body.page + 1 }) },
        'Próxima', icon('arrow-right', { size: 16 })),
    );
  }

  function go(next) {
    page = next.page;
    const q = query();
    history.replaceState(null, '', `${location.pathname}${q.size ? `?${q}` : ''}`);
    load();
  }

  return { reload: load, start: load };
}
