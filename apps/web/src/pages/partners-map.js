/**
 * Mapa /mapa — BR-PARTNER-001/003 · specs/api/partners.md
 */
import '../styles/main.css';
import { api } from '../lib/api.js';
import { mountLayout, showFlash } from '../lib/layout.js';
import { el } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { createPartnersMap, TYPE_ICON } from '../lib/partners-map.js';

const RADIUS_KM = 10;
const map = createPartnersMap(document.getElementById('partners-map'));
const list = document.getElementById('partners-list');
const hint = document.getElementById('list-hint');
const title = document.getElementById('list-title');
const filters = document.getElementById('type-filters');
const locateButton = document.getElementById('locate');

const state = { type: '', position: null };

function renderList(partners) {
  list.replaceChildren(...partners.map((p) =>
    el('li', {},
      el('button', { type: 'button', class: 'partner-item', onclick: () => map.focus(p) },
        el('span', { class: `partner-item-icon partner-pin-${p.type}` }, icon(TYPE_ICON[p.type] ?? 'paw', { size: 14 })),
        el('span', { class: 'min-w-0 flex-1' },
          el('span', { class: 'block truncate font-medium' }, p.name),
          el('span', { class: 'block truncate text-xs text-stone-500' }, p.distanceKm !== undefined ? `${p.typeLabel} · ${p.distanceKm.toLocaleString('pt-BR')} km` : p.typeLabel),
        ),
      ),
    )));
}

async function load() {
  const q = new URLSearchParams();
  if (state.type) q.set('type', state.type);
  if (state.position) {
    q.set('lat', String(state.position.lat));
    q.set('lng', String(state.position.lng));
    q.set('radiusKm', String(RADIUS_KM));
  }
  hint.textContent = 'Carregando…';
  try {
    const { items } = await api(`/partners${q.size ? `?${q}` : ''}`);
    map.show(items);
    renderList(items);
    title.textContent = state.position ? `Perto de você (até ${RADIUS_KM} km)` : 'Parceiros';
    if (items.length) hint.textContent = state.position ? 'Do mais perto para o mais longe. Clique para ver no mapa.' : 'Clique num parceiro para ver no mapa.';
    else hint.textContent = state.position ? `Nenhum parceiro até ${RADIUS_KM} km de você.` : 'Nenhum parceiro cadastrado ainda.';
  } catch {
    hint.textContent = 'Não foi possível carregar os parceiros agora.';
  }
}

filters.addEventListener('click', (e) => {
  const button = e.target.closest('button[data-type]');
  if (!button) return;
  state.type = button.dataset.type;
  for (const b of filters.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === button));
  load();
});

// Só pede a localização quando a pessoa clica (o Flask pedia ao abrir a página).
locateButton.addEventListener('click', () => {
  if (!navigator.geolocation) return showFlash('Seu navegador não informa a localização.', 'warning');
  locateButton.disabled = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locateButton.disabled = false;
      state.position = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      map.markMe(state.position.lat, state.position.lng, RADIUS_KM);
      load();
    },
    () => {
      locateButton.disabled = false;
      showFlash('Não foi possível pegar sua localização. Confira a permissão do navegador.', 'warning');
    },
    { timeout: 8000, maximumAge: 60_000 },
  );
});

mountLayout();
load();
