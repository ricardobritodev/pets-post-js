/**
 * /admin/posts e /admin/adocao — moderação (BR-ADMIN-003/004).
 */
import '../styles/main.css';
import { mountAdmin, adminCall, createAdminTable, statusPill, dateCell } from '../lib/admin.js';
import { showFlash } from '../lib/layout.js';
import { statusBadge, adoptionBadges } from '../lib/post-card.js';
import { el } from '../lib/dom.js';

const isAdoption = location.pathname.startsWith('/admin/adocao');
const kind = isAdoption
  ? { title: 'Moderação de adoção', api: '/admin/adoption', publicApi: '/adoption', page: (id) => `/adocao/${id}`, badges: (a) => adoptionBadges(a)[0] }
  : { title: 'Moderação de posts', api: '/admin/posts', publicApi: '/posts', page: (id) => `/posts/${id}`, badges: (p) => statusBadge(p) };

document.title = `${kind.title} · Admin · Pets Post`;
document.getElementById('admin-title').textContent = kind.title;

if (await mountAdmin()) {
  const act = async (fn, okMessage) => {
    if (await fn()) showFlash(okMessage, 'success');
    table.reload();
  };
  const table = createAdminTable({
    apiPath: kind.api,
    searchLabel: 'Buscar pelo título',
    empty: 'Nenhum anúncio encontrado.',
    filters: [
      { name: 'visibility', label: 'Visibilidade', options: [['active', 'No ar'], ['hidden', 'Ocultos']] },
      ...(isAdoption ? [] : [{ name: 'status', label: 'Situação', options: [['lost', 'Perdidos'], ['found', 'Encontrados']] }]),
    ],
    columns: [
      { label: 'Anúncio', cell: (i) => el('div', {}, el('a', { href: kind.page(i.id), class: 'font-medium hover:text-brand-700' }, i.title), el('div', { class: 'mt-1' }, kind.badges(i))) },
      { label: 'Dono', cell: (i) => el('div', {}, el('p', {}, i.owner?.name ?? '—'), el('p', { class: 'text-xs text-stone-500' }, i.owner?.email ?? '')), class: 'hidden md:table-cell' },
      { label: 'Visível', cell: (i) => statusPill(i.isActive, 'No ar', 'Oculto') },
      { label: 'Data', cell: (i) => dateCell(i.createdAt), class: 'hidden sm:table-cell' },
      {
        label: 'Ações',
        cell: (i) => el('div', { class: 'flex flex-wrap gap-2' },
          el('button', {
            type: 'button',
            class: 'btn btn-outline btn-sm',
            onclick: () => act(() => adminCall(`${kind.api}/${i.id}`, { method: 'PATCH', json: { isActive: !i.isActive } }),
              i.isActive ? 'Anúncio ocultado. Ele não aparece mais no site.' : 'Anúncio de volta ao ar.'),
          }, i.isActive ? 'Ocultar' : 'Reexibir'),
          el('button', {
            type: 'button',
            class: 'btn btn-danger btn-sm',
            onclick: () => {
              if (!confirm(`Excluir "${i.title}"? As fotos também são apagadas. Não dá para desfazer.`)) return;
              act(async () => (await adminCall(`${kind.publicApi}/${i.id}`, { method: 'DELETE' })) !== undefined, 'Anúncio excluído.');
            },
          }, 'Excluir'),
        ),
      },
    ],
  });
  table.start();
}
