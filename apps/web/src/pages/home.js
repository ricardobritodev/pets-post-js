/**
 * Home — destaque + 12 anúncios recentes (BR-POST-004, T4.12).
 */
import '../styles/main.css';
import { api } from '../lib/api.js';
import { mountLayout } from '../lib/layout.js';
import { el } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { renderGrid } from '../lib/post-card.js';

const box = document.getElementById('recent-posts');

const empty = () =>
  el('div', { class: 'card text-center' },
    el('div', { class: 'text-brand-600' }, icon('paw', { size: 48, class: 'mx-auto' })),
    el('h3', { class: 'mt-3 text-lg font-semibold' }, 'Nenhum anúncio ainda'),
    el('p', { class: 'mt-1 text-stone-600' }, 'Seja o primeiro a publicar um anúncio e ajudar um pet a voltar para casa!'),
    el('a', { href: '/posts/criar', class: 'btn btn-primary mt-5' }, 'Criar primeiro anúncio'),
  );

async function loadRecent() {
  try {
    const { items } = await api('/posts/recent');
    box.replaceChildren(renderGrid(items, empty()));
  } catch {
    box.replaceChildren(
      el('div', { class: 'card text-center' },
        el('p', { class: 'text-stone-600' }, 'Não foi possível carregar os anúncios agora.'),
        el('button', { type: 'button', class: 'btn btn-outline mt-4', onclick: loadRecent }, 'Tentar de novo'),
      ),
    );
  } finally {
    box.setAttribute('aria-busy', 'false');
  }
}

mountLayout();
loadRecent();
