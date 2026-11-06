/**
 * map.js — Mapa do detalhe com Leaflet via npm (porta do map-detail.js, T5.12).
 * Carregado sob demanda (import dinâmico): só baixa o Leaflet quando o post tem coordenadas.
 */
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// O ícone padrão do Leaflet acha as imagens pelo CSS, o que não funciona com o bundler.
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const markerIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/**
 * @param {HTMLElement} container
 * @param {{ lat: number, lng: number, label: string, zoom?: number }} place
 */
export function renderMap(container, { lat, lng, label, zoom = 15 }) {
  const map = L.map(container, { scrollWheelZoom: false }).setView([lat, lng], zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  // bindPopup com texto vira innerHTML: o endereço vem do usuário, então vai como nó de texto.
  const popup = document.createElement('span');
  popup.textContent = label;
  L.marker([lat, lng], { icon: markerIcon, alt: label }).addTo(map).bindPopup(popup);
  return map;
}
