/**
 * Detalhe /adocao/:id — BR-ADOPT-003/004 · PERM-001/002 · BR-CONTACT-001
 * O Open Graph deste HTML é injetado pelo servidor (ADR 002).
 */
import '../styles/main.css';
import { api } from '../lib/api.js';
import { mountLayout } from '../lib/layout.js';
import { flash } from '../lib/flash.js';
import { el, formatDate } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { adoptionBadges } from '../lib/post-card.js';
import { gallery } from '../lib/gallery.js';
import { locationCard } from '../lib/location-card.js';
import { row, hiddenNotice, actionButton, ownerBar, contactCard, loadDetail } from '../lib/detail-parts.js';

const root = document.getElementById('adoption');
const id = Number(/^\/adocao\/(\d+)/.exec(location.pathname)?.[1]);
const yesNo = (v) => (v ? 'Sim' : 'Não');

function ownerActions(a) {
  if (!a.canManage) return null;
  return ownerBar(`/adocao/${a.id}/editar`,
    !a.isAdopted && actionButton({
      label: 'Marcar como adotado',
      iconName: 'heart',
      className: 'btn-outline',
      confirmText: 'Marcar como adotado? O anúncio sai da lista de adoção.',
      run: async () => {
        await api(`/adoption/${a.id}/adopted`, { method: 'POST' });
        flash('Que alegria! O pet foi marcado como adotado.', 'success');
        location.reload();
      },
    }),
    actionButton({
      label: 'Excluir',
      iconName: 'trash',
      className: 'btn-danger',
      confirmText: 'Tem certeza que deseja excluir este anúncio? Esta ação não pode ser desfeita.',
      run: async () => {
        await api(`/adoption/${a.id}`, { method: 'DELETE' });
        flash('Anúncio de adoção removido com sucesso.', 'info');
        location.assign('/adocao/');
      },
    }),
  );
}

function render(a) {
  document.title = `Para adoção: ${a.title} · Pets Post`;
  root.replaceChildren(
    el('nav', { class: 'mb-4 text-sm text-stone-500', 'aria-label': 'Você está em' },
      el('a', { href: '/', class: 'hover:underline' }, 'Início'), ' › ',
      el('a', { href: '/adocao/', class: 'hover:underline' }, 'Adoção'), ' › ',
      el('span', { 'aria-current': 'page' }, a.title),
    ),
    ...(a.isActive ? [] : [hiddenNotice()]),
    el('div', { class: 'mb-6' },
      el('div', { class: 'flex flex-wrap gap-2' }, ...adoptionBadges(a, { long: true })),
      el('h1', { class: 'mt-3 text-2xl font-bold sm:text-3xl' }, a.title),
    ),
    el('div', { class: 'grid gap-6 lg:grid-cols-[2fr_1fr]' },
      el('div', { class: 'space-y-6' },
        gallery(a),
        el('section', { class: 'card' },
          el('h2', { class: 'mb-2 text-lg font-semibold' }, 'Sobre o pet'),
          el('p', { class: 'whitespace-pre-line text-stone-700' }, a.description),
        ),
        a.adopterRequirements && el('section', { class: 'card' },
          el('h2', { class: 'mb-2 flex items-center gap-2 text-lg font-semibold' }, icon('check-circle', { class: 'text-brand-600' }), 'Requisitos para adotar'),
          el('p', { class: 'whitespace-pre-line text-stone-700' }, a.adopterRequirements),
        ),
        locationCard({ label: 'Onde está', address: a.location, lat: a.locationLat, lng: a.locationLng }),
        ownerActions(a),
      ),
      el('div', { class: 'space-y-6' },
        el('section', { class: 'card' },
          el('h2', { class: 'mb-2 flex items-center gap-2 text-lg font-semibold' }, icon('paw', { class: 'text-brand-600' }), 'Informações do pet'),
          el('dl', {},
            row('Nome', a.petName),
            row('Tipo', a.petTypeLabel),
            row('Raça', a.petBreed),
            row('Cor / Pelagem', a.petColor),
            row('Porte', a.petSizeLabel),
            row('Castrado', yesNo(a.isNeutered)),
            row('Vacinado', yesNo(a.isVaccinated)),
            row('Publicado em', formatDate(a.createdAt)),
          ),
        ),
        contactCard(a),
      ),
    ),
  );
}

await mountLayout();
await loadDetail({ root, id, apiPath: '/adoption', key: 'adoption', render, listHref: '/adocao/', listLabel: 'Ver pets para adoção' });
