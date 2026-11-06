/**
 * partners-map.js — Mapa de parceiros com Leaflet (porta do map-partners.js, T6.8).
 *
 * Diferenças para o Flask: o popup é montado com elementos DOM (o antigo colava nome e
 * endereço como HTML, o que abria brecha de XSS) e não precisa do plugin de cluster
 * (são poucas dezenas de pontos).
 */
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { iconSvg } from './icon-data.js';
import { el } from './dom.js';
import { icon } from './icons.js';

export const TYPE_ICON = Object.freeze({ foster_home: 'home', petshop: 'shopping-bag', vet_clinic: 'plus-circle' });
const BRAZIL = { center: [-15.788, -47.879], zoom: 4 };

/** Pino colorido por tipo. O HTML é fixo (ícone do nosso arquivo), sem dado do usuário. */
const pinFor = (type) =>
  L.divIcon({
    className: '',
    html: `<div class="partner-pin partner-pin-${type}">${iconSvg(TYPE_ICON[type] ?? 'paw', { size: 16 })}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });

/** Popup com contato. Tudo via textContent/atributos. */
export function partnerPopup(p) {
  const line = (iconName, child) => el('p', { class: 'partner-popup-line' }, icon(iconName, { size: 14 }), child);
  return el('div', { class: 'partner-popup' },
    el('strong', { class: 'block text-base' }, p.name),
    el('span', { class: `partner-type partner-type-${p.type}` }, p.typeLabel),
    p.distanceKm !== undefined && el('span', { class: 'ml-2 text-xs text-stone-500' }, `${p.distanceKm.toLocaleString('pt-BR')} km`),
    line('map-pin', p.address),
    p.phone && line('phone', el('a', { href: `tel:${p.phone.replace(/\D/g, '')}` }, p.phone)),
    p.email && line('envelope', el('a', { href: `mailto:${p.email}` }, p.email)),
    p.website && line('globe', el('a', { href: p.website, target: '_blank', rel: 'noopener noreferrer' }, 'Visitar site')),
    el('div', { class: 'mt-2 flex flex-wrap gap-2' },
      p.whatsappUrl && el('a', { href: p.whatsappUrl, target: '_blank', rel: 'noopener noreferrer', class: 'btn btn-whatsapp btn-sm' }, icon('chat', { size: 14 }), 'WhatsApp'),
      el('a', {
        href: `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`,
        target: '_blank',
        rel: 'noopener noreferrer',
        class: 'btn btn-outline btn-sm',
      }, 'Como chegar', icon('arrow-right', { size: 14 })),
    ),
  );
}

/**
 * @param {HTMLElement} container
 * @returns {{ show: (partners: object[]) => void, focus: (p: object) => void, markMe: (lat: number, lng: number, radiusKm: number) => void }}
 */
export function createPartnersMap(container) {
  const map = L.map(container, { scrollWheelZoom: false }).setView(BRAZIL.center, BRAZIL.zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  const markers = L.layerGroup().addTo(map);
  const byId = new Map();
  let me = null;

  return {
    show(partners) {
      markers.clearLayers();
      byId.clear();
      for (const p of partners) {
        const marker = L.marker([p.lat, p.lng], { icon: pinFor(p.type), alt: p.name, title: p.name })
          .bindPopup(() => partnerPopup(p), { minWidth: 220 });
        markers.addLayer(marker);
        byId.set(p.id, marker);
      }
      if (partners.length && !me) {
        map.fitBounds(L.latLngBounds(partners.map((p) => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 14 });
      }
    },
    focus(p) {
      map.setView([p.lat, p.lng], Math.max(map.getZoom(), 15));
      byId.get(p.id)?.openPopup();
    },
    markMe(lat, lng, radiusKm) {
      me?.remove();
      me = L.layerGroup([
        L.circle([lat, lng], { radius: radiusKm * 1000, color: '#2563eb', weight: 1, fillOpacity: 0.05 }),
        L.circleMarker([lat, lng], { radius: 8, color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.5, weight: 2 })
          .bindTooltip('Você está aqui'),
      ]).addTo(map);
      map.setView([lat, lng], radiusKm <= 10 ? 13 : 11);
    },
  };
}
