/**
 * Detalhe /posts/:id — T4.14 · PERM-001/002 · BR-POST-005/006 · BR-CONTACT-001
 * O Open Graph deste HTML é injetado pelo servidor (ADR 002); aqui só o conteúdo.
 */
import '../styles/main.css';
import { api } from '../lib/api.js';
import { mountLayout } from '../lib/layout.js';
import { flash } from '../lib/flash.js';
import { el, formatDate } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { statusBadge } from '../lib/post-card.js';
import { gallery } from '../lib/gallery.js';
import { locationCard } from '../lib/location-card.js';
import { row, hiddenNotice, actionButton, ownerBar, contactCard, loadDetail } from '../lib/detail-parts.js';

const root = document.getElementById('post');
const id = Number(/^\/posts\/(\d+)/.exec(location.pathname)?.[1]);

function ownerActions(post) {
  if (!post.canManage) return null;
  return ownerBar(`/posts/${post.id}/editar`,
    !post.isResolved && actionButton({
      label: 'Marcar como resolvido',
      iconName: 'check-circle',
      className: 'btn-outline',
      confirmText: 'Marcar este post como resolvido? O pet foi reencontrado!',
      run: async () => {
        await api(`/posts/${post.id}/resolve`, { method: 'POST' });
        flash('Que ótima notícia! O post foi marcado como resolvido.', 'success');
        location.reload();
      },
    }),
    actionButton({
      label: 'Excluir',
      iconName: 'trash',
      className: 'btn-danger',
      confirmText: 'Tem certeza que deseja excluir este anúncio? Esta ação não pode ser desfeita.',
      run: async () => {
        await api(`/posts/${post.id}`, { method: 'DELETE' });
        flash('Anúncio removido com sucesso.', 'info');
        location.assign('/posts/');
      },
    }),
  );
}

function render(post) {
  const placeLabel = post.status === 'lost' ? 'Visto por último em' : 'Encontrado em';
  document.title = `${post.statusLabel}: ${post.title} · Pets Post`;
  root.replaceChildren(
    el('nav', { class: 'mb-4 text-sm text-stone-500', 'aria-label': 'Você está em' },
      el('a', { href: '/', class: 'hover:underline' }, 'Início'), ' › ',
      el('a', { href: '/posts/', class: 'hover:underline' }, 'Posts'), ' › ',
      el('span', { 'aria-current': 'page' }, post.title),
    ),
    // replaceChildren (diferente do el()) escreveria `false` como texto: por isso o spread.
    ...(post.isActive ? [] : [hiddenNotice()]),
    el('div', { class: 'mb-6' },
      statusBadge(post, { long: true }),
      el('h1', { class: 'mt-3 text-2xl font-bold sm:text-3xl' }, post.title),
    ),
    el('div', { class: 'grid gap-6 lg:grid-cols-[2fr_1fr]' },
      el('div', { class: 'space-y-6' },
        gallery(post),
        el('section', { class: 'card' },
          el('h2', { class: 'mb-2 text-lg font-semibold' }, 'Descrição'),
          el('p', { class: 'whitespace-pre-line text-stone-700' }, post.description),
        ),
        locationCard({ label: placeLabel, address: post.lastSeenLocation, lat: post.lastSeenLat, lng: post.lastSeenLng }),
        ownerActions(post),
      ),
      el('div', { class: 'space-y-6' },
        el('section', { class: 'card' },
          el('h2', { class: 'mb-2 flex items-center gap-2 text-lg font-semibold' }, icon('paw', { class: 'text-brand-600' }), 'Informações do pet'),
          el('dl', {},
            row('Nome', post.petName),
            row('Tipo', post.petTypeLabel),
            row('Raça', post.petBreed),
            row('Cor / Pelagem', post.petColor),
            row('Porte', post.petSizeLabel),
            row(placeLabel, post.lastSeenLocation),
            row('Publicado em', formatDate(post.createdAt)),
          ),
        ),
        contactCard(post,
          post.reward ? el('p', { class: 'flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 font-semibold text-amber-800' }, icon('trophy'), post.reward) : null),
      ),
    ),
  );
}

await mountLayout();
await loadDetail({ root, id, apiPath: '/posts', key: 'post', render, listHref: '/posts/', listLabel: 'Ver todos os anúncios' });
