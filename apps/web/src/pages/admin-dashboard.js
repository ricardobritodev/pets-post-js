/**
 * /admin — Dashboard (BR-ADMIN-001/004).
 */
import '../styles/main.css';
import { mountAdmin, adminCall, dateCell } from '../lib/admin.js';
import { el } from '../lib/dom.js';
import { icon } from '../lib/icons.js';

const stat = (label, value, href, tone = '') =>
  el('a', { href, class: `stat-card ${tone}` }, el('span', { class: 'stat-value' }, String(value)), el('span', { class: 'stat-label' }, label));

const group = (title, iconName, ...cards) =>
  el('section', { class: 'space-y-3' },
    el('h2', { class: 'flex items-center gap-2 text-lg font-semibold' }, icon(iconName, { class: 'text-brand-600' }), title),
    el('div', { class: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6' }, ...cards));

const recentList = (title, items, line) =>
  el('section', { class: 'card space-y-2 p-4 sm:p-5' },
    el('h2', { class: 'text-lg font-semibold' }, title),
    items.length ? el('ul', { class: 'divide-y divide-stone-100' }, ...items.map((i) => el('li', { class: 'py-2' }, line(i))))
      : el('p', { class: 'text-sm text-stone-500' }, 'Nada ainda.'));

if (await mountAdmin()) {
  const s = await adminCall('/admin/stats');
  if (s) {
    document.getElementById('admin-content').replaceChildren(
      el('div', { class: 'space-y-8' },
        group('Posts de perdidos e encontrados', 'megaphone',
          stat('no ar', s.posts.active, '/admin/posts?visibility=active'),
          stat('perdidos', s.posts.lost, '/admin/posts?status=lost', 'stat-lost'),
          stat('encontrados', s.posts.found, '/admin/posts?status=found', 'stat-found'),
          stat('resolvidos', s.posts.resolved, '/admin/posts'),
          stat('ocultos', s.posts.hidden, '/admin/posts?visibility=hidden', 'stat-muted'),
          stat('total', s.posts.total, '/admin/posts')),
        group('Adoção', 'home',
          stat('disponíveis', s.adoption.available, '/admin/adocao?visibility=active'),
          stat('adotados', s.adoption.adopted, '/admin/adocao', 'stat-found'),
          stat('ocultos', s.adoption.hidden, '/admin/adocao?visibility=hidden', 'stat-muted'),
          stat('total', s.adoption.total, '/admin/adocao')),
        group('Pessoas e parceiros', 'user',
          stat('usuários ativos', s.users.active, '/admin/usuarios'),
          stat('usuários', s.users.total, '/admin/usuarios'),
          stat('parceiros ativos', s.partners.active, '/admin/parceiros'),
          stat('sem mapa', s.partners.withoutCoords, '/admin/parceiros', s.partners.withoutCoords ? 'stat-lost' : 'stat-muted')),
        el('div', { class: 'grid gap-6 lg:grid-cols-3' },
          recentList('Posts recentes', s.recent.posts, (p) => el('div', {},
            el('a', { href: `/posts/${p.id}`, class: 'font-medium hover:text-brand-700' }, p.title),
            el('p', { class: 'text-xs text-stone-500' }, `${p.statusLabel} · ${p.owner?.name ?? '—'} · `, dateCell(p.createdAt)))),
          recentList('Adoções recentes', s.recent.adoptions, (a) => el('div', {},
            el('a', { href: `/adocao/${a.id}`, class: 'font-medium hover:text-brand-700' }, a.title),
            el('p', { class: 'text-xs text-stone-500' }, `${a.petTypeLabel} · ${a.owner?.name ?? '—'} · `, dateCell(a.createdAt)))),
          recentList('Usuários recentes', s.recent.users, (u) => el('div', {},
            el('p', { class: 'font-medium' }, u.name),
            el('p', { class: 'text-xs text-stone-500' }, `${u.email} · `, dateCell(u.createdAt)))),
        ),
      ),
    );
  }
}
