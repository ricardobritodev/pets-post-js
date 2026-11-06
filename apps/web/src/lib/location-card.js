/**
 * location-card.js — Card "Localização" do detalhe, com mapa quando há coordenadas (BR-GEO-001).
 * O Leaflet é baixado sob demanda (import dinâmico de map.js).
 */
import { el } from './dom.js';
import { icon } from './icons.js';

/**
 * @param {{ label: string, address: string, lat: number|null, lng: number|null }} place
 */
export function locationCard({ label, address, lat, lng }) {
  const hasCoords = lat != null && lng != null;
  const mapBox = hasCoords && el('div', { class: 'detail-map', role: 'region', 'aria-label': `Mapa: ${address}` });
  if (mapBox) {
    import('./map.js')
      .then(({ renderMap }) => renderMap(mapBox, { lat, lng, label: address }))
      .catch(() => mapBox.replaceChildren(el('p', { class: 'p-4 text-sm text-stone-500' }, 'Não foi possível carregar o mapa.')));
  }
  return el('section', { class: 'card space-y-3' },
    el('h2', { class: 'flex items-center gap-2 text-lg font-semibold' }, icon('map-pin', { class: 'text-brand-600' }), 'Localização'),
    el('p', { class: 'text-stone-700' }, el('span', { class: 'text-stone-500' }, `${label}: `), address),
    mapBox || el('p', { class: 'text-sm text-stone-500' }, 'O mapa aparece quando o endereço for localizado.'),
  );
}
