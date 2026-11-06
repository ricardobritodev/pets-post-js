/**
 * Detalhe /posts/:id — T4.14 · PERM-001/002 · BR-POST-005/006 · BR-CONTACT-001
 * O Open Graph deste HTML é injetado pelo servidor (ADR 002); aqui só o conteúdo.
 */
import '../styles/main.css';
import { api, ApiError } from '../lib/api.js';
import { mountLayout, showFlash } from '../lib/layout.js';
import { flash } from '../lib/flash.js';
import { el, formatDate } from '../lib/dom.js';
import { statusBadge, petImage } from '../lib/post-card.js';

const root = document.getElementById('post');
const id = Number(/^\/posts\/(\d+)/.exec(location.pathname)?.[1]);

function notFound() {
  document.title = 'Anúncio não encontrado · Pets Post';
  root.replaceChildren(
    el('div', { class: 'card mx-auto max-w-lg text-center' },
      el('div', { class: 'text-5xl', 'aria-hidden': 'true' }, '🐾'),
      el('h1', { class: 'mt-3 text-xl font-bold' }, 'Anúncio não encontrado'),
      el('p', { class: 'mt-1 text-stone-600' }, 'Ele pode ter sido removido ou o link está incorreto.'),
      el('a', { href: '/posts/', class: 'btn btn-primary mt-5' }, 'Ver todos os anúncios'),
    ),
  );
}

function gallery(post) {
  if (post.photos.length === 0) return petImage(post, 'gallery-main');
  const primary = post.photos.find((p) => p.url === post.primaryPhoto?.url) ?? post.photos[0];
  const alt = `Foto de ${post.petName || post.petTypeLabel}`;
  const main = el('img', { src: primary.url, alt, class: 'gallery-main' });
  if (post.photos.length === 1) return main;
  const thumbs = post.photos.map((photo, i) =>
    el('button', {
      type: 'button',
      class: 'gallery-thumb',
      'aria-label': `Ver foto ${i + 1}`,
      'aria-pressed': String(photo === primary),
      onclick: (e) => {
        main.src = photo.url;
        e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        e.currentTarget.setAttribute('aria-pressed', 'true');
      },
    }, el('img', { src: photo.url, alt: `Foto ${i + 1} de ${post.petName || post.petTypeLabel}`, loading: 'lazy' })),
  );
  return el('div', {}, main, el('div', { class: 'mt-3 flex flex-wrap gap-2' }, thumbs));
}

const row = (label, value) =>
  value ? el('div', { class: 'flex justify-between gap-4 border-b border-stone-100 py-2 last:border-0' },
    el('dt', { class: 'text-stone-500' }, label), el('dd', { class: 'text-right font-medium' }, value)) : null;

function ownerActions(post) {
  if (!post.canManage) return null;
  const run = async (button, fn) => {
    button.disabled = true;
    try {
      await fn();
    } catch (err) {
      showFlash(err instanceof ApiError ? err.message : 'Sem conexão com o servidor.', 'danger');
      button.disabled = false;
    }
  };
  const resolve = el('button', {
    type: 'button',
    class: 'btn btn-outline btn-sm',
    onclick: (e) => {
      if (!confirm('Marcar este post como resolvido? O pet foi reencontrado!')) return;
      run(e.currentTarget, async () => {
        await api(`/posts/${post.id}/resolve`, { method: 'POST' });
        flash('Que ótima notícia! O post foi marcado como resolvido. 🎉', 'success');
        location.reload();
      });
    },
  }, '✓ Marcar como resolvido');
  const remove = el('button', {
    type: 'button',
    class: 'btn btn-danger btn-sm',
    onclick: (e) => {
      if (!confirm('Tem certeza que deseja excluir este anúncio? Esta ação não pode ser desfeita.')) return;
      run(e.currentTarget, async () => {
        await api(`/posts/${post.id}`, { method: 'DELETE' });
        flash('Anúncio removido com sucesso.', 'info');
        location.assign('/posts/');
      });
    },
  }, '🗑 Excluir');

  return el('div', { class: 'card flex flex-wrap items-center gap-2 p-4 sm:p-4' },
    el('span', { class: 'mr-auto text-sm text-stone-600' }, 'Este anúncio é seu.'),
    el('a', { href: `/posts/${post.id}/editar`, class: 'btn btn-outline btn-sm' }, '✏️ Editar'),
    !post.isResolved && resolve,
    remove,
  );
}

/** Mapa só quando a geocodificação achou o endereço (BR-GEO-001). O Leaflet é baixado sob demanda. */
function locationCard(post) {
  const label = post.status === 'lost' ? 'Visto por último em' : 'Encontrado em';
  const hasCoords = post.lastSeenLat != null && post.lastSeenLng != null;
  const mapBox = hasCoords && el('div', { class: 'detail-map', role: 'region', 'aria-label': `Mapa: ${post.lastSeenLocation}` });
  if (mapBox) {
    import('../lib/map.js')
      .then(({ renderMap }) => renderMap(mapBox, { lat: post.lastSeenLat, lng: post.lastSeenLng, label: post.lastSeenLocation }))
      .catch(() => mapBox.replaceChildren(el('p', { class: 'p-4 text-sm text-stone-500' }, 'Não foi possível carregar o mapa.')));
  }
  return el('section', { class: 'card space-y-3' },
    el('h2', { class: 'text-lg font-semibold' }, '📍 Localização'),
    el('p', { class: 'text-stone-700' }, el('span', { class: 'text-stone-500' }, `${label}: `), post.lastSeenLocation),
    mapBox || el('p', { class: 'text-sm text-stone-500' }, 'O mapa aparece quando o endereço for localizado.'),
  );
}

function contactCard(post) {
  return el('aside', { class: 'card space-y-3' },
    el('h2', { class: 'text-lg font-semibold' }, '📞 Contato'),
    post.whatsappUrl
      ? el('a', { href: post.whatsappUrl, target: '_blank', rel: 'noopener noreferrer', class: 'btn btn-whatsapp w-full' }, '💬 Chamar no WhatsApp')
      : null,
    el('p', {}, el('a', { href: `tel:${post.contactPhone.replace(/\D/g, '')}`, class: 'font-medium text-brand-700 hover:underline' }, post.contactPhone)),
    post.contactEmail ? el('p', {}, el('a', { href: `mailto:${post.contactEmail}`, class: 'text-brand-700 hover:underline' }, post.contactEmail)) : null,
    post.reward ? el('p', { class: 'rounded-lg bg-amber-50 px-3 py-2 font-semibold text-amber-800' }, `🏆 ${post.reward}`) : null,
    post.owner ? el('p', { class: 'text-sm text-stone-500' }, `Publicado por ${post.owner.name}`) : null,
  );
}

function render(post) {
  document.title = `${post.statusLabel}: ${post.title} · Pets Post`;
  root.replaceChildren(
    el('nav', { class: 'mb-4 text-sm text-stone-500', 'aria-label': 'Você está em' },
      el('a', { href: '/', class: 'hover:underline' }, 'Início'), ' › ',
      el('a', { href: '/posts/', class: 'hover:underline' }, 'Posts'), ' › ',
      el('span', { 'aria-current': 'page' }, post.title),
    ),
    // replaceChildren (diferente do el()) escreveria `false` como texto: por isso o spread.
    ...(post.isActive ? [] : [el('p', { class: 'flash flash-warning mb-4' }, 'Este anúncio está oculto e só você (ou um admin) pode vê-lo.')]),
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
        locationCard(post),
        ownerActions(post),
      ),
      el('div', { class: 'space-y-6' },
        el('section', { class: 'card' },
          el('h2', { class: 'mb-2 text-lg font-semibold' }, '🐾 Informações do pet'),
          el('dl', {},
            row('Nome', post.petName),
            row('Tipo', post.petTypeLabel),
            row('Raça', post.petBreed),
            row('Cor / Pelagem', post.petColor),
            row('Porte', post.petSizeLabel),
            row(post.status === 'lost' ? 'Visto por último em' : 'Encontrado em', post.lastSeenLocation),
            row('Publicado em', formatDate(post.createdAt)),
          ),
        ),
        contactCard(post),
      ),
    ),
  );
}

await mountLayout();
if (!id) {
  notFound();
} else {
  try {
    const { post } = await api(`/posts/${id}`);
    render(post);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    else root.replaceChildren(el('div', { class: 'card text-center' },
      el('p', { class: 'text-stone-600' }, 'Não foi possível carregar o anúncio agora.'),
      el('button', { type: 'button', class: 'btn btn-outline mt-4', onclick: () => location.reload() }, 'Tentar de novo')));
  }
}
root.setAttribute('aria-busy', 'false');
