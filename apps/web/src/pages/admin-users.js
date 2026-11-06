/**
 * /admin/usuarios — busca e ativar/desativar (BR-ADMIN-002/005, PERM-005).
 */
import '../styles/main.css';
import { mountAdmin, adminCall, createAdminTable, statusPill, dateCell } from '../lib/admin.js';
import { showFlash } from '../lib/layout.js';
import { el } from '../lib/dom.js';

const me = await mountAdmin();
if (me) {
  const table = createAdminTable({
    apiPath: '/admin/users',
    searchLabel: 'Buscar por nome ou email',
    empty: 'Nenhum usuário encontrado.',
    columns: [
      { label: 'Nome', cell: (u) => el('div', {}, el('p', { class: 'font-medium' }, u.name), el('p', { class: 'text-xs text-stone-500' }, u.email)) },
      { label: 'Telefone', cell: (u) => u.phone ?? '—', class: 'hidden md:table-cell' },
      { label: 'Papel', cell: (u) => (u.role === 'admin' ? el('span', { class: 'badge' }, 'admin') : 'usuário') },
      { label: 'Anúncios', cell: (u) => `${u.postCount} posts · ${u.adoptionCount} adoção`, class: 'hidden lg:table-cell' },
      { label: 'Situação', cell: (u) => statusPill(u.isActive, 'Ativo', 'Desativado') },
      { label: 'Cadastro', cell: (u) => dateCell(u.createdAt), class: 'hidden sm:table-cell' },
      {
        label: 'Ação',
        cell: (u) => u.id === me.id
          ? el('span', { class: 'text-xs text-stone-400' }, 'você')
          : el('button', {
            type: 'button',
            class: `btn btn-sm ${u.isActive ? 'btn-outline' : 'btn-primary'}`,
            onclick: async (e) => {
              const verb = u.isActive ? 'Desativar' : 'Reativar';
              if (!confirm(`${verb} ${u.name}?${u.isActive ? ' A pessoa sai de todos os dispositivos e não consegue mais entrar.' : ''}`)) return;
              e.currentTarget.disabled = true;
              const res = await adminCall(`/admin/users/${u.id}/toggle`, { method: 'POST' });
              if (res) showFlash(`${res.user.name} foi ${res.user.isActive ? 'reativado(a)' : 'desativado(a)'}.`, 'success');
              table.reload();
            },
          }, u.isActive ? 'Desativar' : 'Reativar'),
      },
    ],
  });
  table.start();
}
