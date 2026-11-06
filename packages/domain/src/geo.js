/**
 * geo.js — Distância entre coordenadas (BR-PARTNER-003). Puro, sem I/O.
 * Base da busca "perto de mim" do mapa e, depois, do bot (Etapa 8).
 */

const EARTH_RADIUS_KM = 6371;
const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Distância em linha reta (Haversine), em km.
 * @param {{ lat: number, lng: number }} a
 * @param {{ lat: number, lng: number }} b
 */
export function haversineKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Retângulo que contém o círculo (para filtrar no banco antes do cálculo exato).
 * @param {{ lat: number, lng: number }} center
 * @param {number} radiusKm
 */
export function boundingBox({ lat, lng }, radiusKm) {
  const dLat = radiusKm / 111.32;
  const cos = Math.cos(rad(lat));
  const dLng = cos < 1e-6 ? 180 : Math.min(180, radiusKm / (111.32 * cos));
  return {
    minLat: Math.max(-90, lat - dLat),
    maxLat: Math.min(90, lat + dLat),
    minLng: Math.max(-180, lng - dLng),
    maxLng: Math.min(180, lng + dLng),
  };
}

/** BR-PARTNER-002 — só links http/https vão para a tela (bloqueia `javascript:` e afins). */
export function safeWebsite(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}
