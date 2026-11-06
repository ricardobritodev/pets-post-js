/**
 * detail-parts.js — Pedaços das páginas de detalhe (posts e adoção).
 */
import { api, ApiError } from './api.js';
import { showFlash } from './layout.js';
import { el } from './dom.js';
import { icon } from './icons.js';

/** Linha "rótulo: valor" da lista de informações. Valor vazio não aparece. */
export const row = (label, value) =>
  value ? el('div', { class: 'flex justify-between gap-4 border-b border-stone-100 py-2 last:border-0' },
    el('dt', { class: 'text-stone-500' }, label), el('dd', { class: 'text-right font-medium' }, value)) : null;

/** PERM-002 — inexistente ou inativo de outra pessoa. */
export function notFoundCard({ listHref, listLabel }) {
  document.title = 'Anúncio não encontrado · Pets Post';
  return el('div', { class: 'card mx-auto max-w-lg text-center' },
    el('div', { class: 'text-brand-600' }, icon('paw', { size: 48, class: 'mx-auto' })),
    el('h1', { class: 'mt-3 text-xl font-bold' }, 'Anúncio não encontrado'),
    el('p', { class: 'mt-1 text-stone-600' }, 'Ele pode ter sido removido ou o link está incorreto.'),
    el('a', { href: listHref, class: 'btn btn-primary mt-5' }, listLabel),
  );
}

export const loadError = () =>
  el('div', { class: 'card text-center' },
    el('p', { class: 'text-stone-600' }, 'Não foi possível carregar o anúncio agora.'),
    el('button', { type: 'button', class: 'btn btn-outline mt-4', onclick: () => location.reload() }, 'Tentar de novo'));

export const hiddenNotice = () =>
  el('p', { class: 'flash flash-warning mb-4' }, 'Este anúncio está oculto e só você (ou um admin) pode vê-lo.');

/**
 * Botão de ação do dono, com confirmação. Erro da API vira mensagem e o botão volta.
 * @param {{ label: string, iconName: string, className: string, confirmText: string, run: () => Promise<void> }} o
 */
export function actionButton({ label, iconName, className, confirmText, run }) {
  return el('button', {
    type: 'button',
    class: `btn btn-sm ${className}`,
    onclick: async (e) => {
      if (!confirm(confirmText)) return;
      const button = e.currentTarget;
      button.disabled = true;
      try {
        await run();
      } catch (err) {
        showFlash(err instanceof ApiError ? err.message : 'Sem conexão com o servidor.', 'danger');
        button.disabled = false;
      }
    },
  }, icon(iconName, { size: 16 }), label);
}

/** Barra "Este anúncio é seu" com Editar + ações. */
export function ownerBar(editHref, ...actions) {
  return el('div', { class: 'card flex flex-wrap items-center gap-2 p-4 sm:p-4' },
    el('span', { class: 'mr-auto text-sm text-stone-600' }, 'Este anúncio é seu.'),
    el('a', { href: editHref, class: 'btn btn-outline btn-sm' }, icon('pencil', { size: 16 }), 'Editar'),
    ...actions,
  );
}

/** Card de contato (WhatsApp, telefone, email, quem publicou). `extra` entra antes do autor. */
export function contactCard(item, ...extra) {
  return el('aside', { class: 'card space-y-3' },
    el('h2', { class: 'flex items-center gap-2 text-lg font-semibold' }, icon('phone', { class: 'text-brand-600' }), 'Contato'),
    item.whatsappUrl
      ? el('a', { href: item.whatsappUrl, target: '_blank', rel: 'noopener noreferrer', class: 'btn btn-whatsapp w-full' }, icon('chat'), 'Chamar no WhatsApp')
      : null,
    el('p', {}, el('a', { href: `tel:${item.contactPhone.replace(/\D/g, '')}`, class: 'font-medium text-brand-700 hover:underline' }, item.contactPhone)),
    item.contactEmail ? el('p', {}, el('a', { href: `mailto:${item.contactEmail}`, class: 'text-brand-700 hover:underline' }, item.contactEmail)) : null,
    ...extra,
    item.owner ? el('p', { class: 'text-sm text-stone-500' }, `Publicado por ${item.owner.name}`) : null,
  );
}

/**
 * Carrega o anúncio e desenha (ou mostra "não encontrado"/erro).
 * @param {{ root: HTMLElement, id: number, apiPath: string, key: string, render: (item: object) => void,
 *           listHref: string, listLabel: string }} o
 */
export async function loadDetail({ root, id, apiPath, key, render, listHref, listLabel }) {
  try {
    if (!id) throw new ApiError(404, 'NOT_FOUND', '');
    const body = await api(`${apiPath}/${id}`);
    render(body[key]);
  } catch (err) {
    root.replaceChildren(err instanceof ApiError && err.status === 404 ? notFoundCard({ listHref, listLabel }) : loadError());
  } finally {
    root.setAttribute('aria-busy', 'false');
  }
}
