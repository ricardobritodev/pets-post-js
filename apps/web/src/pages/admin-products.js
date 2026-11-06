/**
 * /admin/produtos — produtos da loja (BR-STORE-006).
 */
import '../styles/main.css';
import { formatBRL } from '@petspost/domain/store';
import { mountAdmin, adminCall, createAdminTable, statusPill } from '../lib/admin.js';
import { showFlash } from '../lib/layout.js';
import { el } from '../lib/dom.js';
import { icon } from '../lib/icons.js';

const CATEGORY_OPTIONS = [['food', 'Ração'], ['treats', 'Petiscos'], ['toys', 'Brinquedos'], ['hygiene', 'Higiene'],
  ['health', 'Saúde'], ['accessories', 'Acessórios'], ['beds', 'Camas']];

if (await mountAdmin()) {
  document.getElementById('admin-title').after(
    el('a', { href: '/admin/produtos/criar', class: 'btn btn-primary mb-6' }, icon('plus', { size: 18 }), 'Novo produto'));
  const table = createAdminTable({
    apiPath: '/admin/products',
    searchLabel: 'Buscar pelo nome',
    empty: 'Nenhum produto ainda.',
    filters: [
      { name: 'category', label: 'Categoria', options: CATEGORY_OPTIONS },
      { name: 'visibility', label: 'Situação', options: [['active', 'Ativos'], ['hidden', 'Inativos']] },
    ],
    columns: [
      {
        label: 'Produto',
        cell: (p) => el('div', { class: 'flex items-center gap-3' },
          p.primaryPhoto
            ? el('img', { src: p.primaryPhoto.url, alt: '', class: 'size-10 shrink-0 rounded object-cover' })
            : el('span', { class: 'flex size-10 shrink-0 items-center justify-center rounded bg-brand-50 text-brand-500' }, icon('shopping-bag', { size: 18 })),
          el('div', {},
            el('a', { href: `/loja/produto/${p.id}`, class: 'font-medium hover:text-brand-700' }, p.name),
            el('p', { class: 'text-xs text-stone-500' }, `${p.categoryLabel} · ${p.partner?.name ?? '—'}`))),
      },
      {
        label: 'Preço',
        cell: (p) => el('div', { class: 'whitespace-nowrap' },
          el('p', { class: 'font-medium' }, formatBRL(p.finalPriceCents)),
          p.discountPercent != null && el('p', { class: 'text-xs text-stone-500 line-through' }, formatBRL(p.priceCents))),
      },
      { label: 'Estoque', cell: (p) => (p.stock > 0 ? String(p.stock) : el('span', { class: 'text-lost-600' }, 'esgotado')), class: 'hidden sm:table-cell' },
      {
        label: 'Situação',
        cell: (p) => el('div', { class: 'flex flex-wrap gap-1' },
          statusPill(p.isActive && p.partnerActive, 'Na vitrine', p.isActive ? 'Parceiro inativo' : 'Inativo'),
          p.isFeatured && el('span', { class: 'badge' }, 'destaque')),
      },
      {
        label: 'Ações',
        cell: (p) => el('div', { class: 'flex flex-wrap gap-2' },
          el('a', { href: `/admin/produtos/${p.id}/editar`, class: 'btn btn-outline btn-sm' }, icon('pencil', { size: 16 }), 'Editar'),
          el('button', {
            type: 'button',
            class: 'btn btn-danger btn-sm',
            onclick: async () => {
              if (!confirm(`Excluir "${p.name}"? As fotos também são apagadas.`)) return;
              if ((await adminCall(`/admin/products/${p.id}`, { method: 'DELETE' })) !== undefined) showFlash('Produto excluído.', 'success');
              table.reload();
            },
          }, 'Excluir')),
      },
    ],
  });
  table.start();
}
