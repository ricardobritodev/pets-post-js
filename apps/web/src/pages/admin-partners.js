/**
 * /admin/parceiros — lista, editar e excluir (BR-PARTNER-002).
 */
import '../styles/main.css';
import { mountAdmin, adminCall, createAdminTable, statusPill } from '../lib/admin.js';
import { showFlash } from '../lib/layout.js';
import { el } from '../lib/dom.js';
import { icon } from '../lib/icons.js';

if (await mountAdmin()) {
  document.getElementById('admin-title').after(
    el('a', { href: '/admin/parceiros/criar', class: 'btn btn-primary mb-6' }, icon('plus', { size: 18 }), 'Novo parceiro'));
  const table = createAdminTable({
    apiPath: '/admin/partners',
    searchLabel: 'Buscar pelo nome',
    empty: 'Nenhum parceiro encontrado.',
    filters: [{ name: 'type', label: 'Tipo', options: [['foster_home', 'Lar temporário'], ['petshop', 'Petshop'], ['vet_clinic', 'Clínica']] }],
    columns: [
      { label: 'Nome', cell: (p) => el('div', {}, el('p', { class: 'font-medium' }, p.name), el('p', { class: 'text-xs text-stone-500' }, p.typeLabel)) },
      { label: 'Endereço', cell: (p) => p.address, class: 'hidden md:table-cell' },
      { label: 'No mapa', cell: (p) => statusPill(p.lat != null, 'Sim', 'Sem coordenadas') },
      { label: 'Situação', cell: (p) => statusPill(p.isActive, 'Ativo', 'Inativo'), class: 'hidden sm:table-cell' },
      {
        label: 'Ações',
        cell: (p) => el('div', { class: 'flex flex-wrap gap-2' },
          el('a', { href: `/admin/parceiros/${p.id}/editar`, class: 'btn btn-outline btn-sm' }, icon('pencil', { size: 16 }), 'Editar'),
          el('button', {
            type: 'button',
            class: 'btn btn-danger btn-sm',
            onclick: async () => {
              if (!confirm(`Excluir o parceiro "${p.name}"?`)) return;
              if ((await adminCall(`/admin/partners/${p.id}`, { method: 'DELETE' })) !== undefined) showFlash('Parceiro excluído.', 'success');
              table.reload();
            },
          }, 'Excluir'),
        ),
      },
    ],
  });
  table.start();
}
