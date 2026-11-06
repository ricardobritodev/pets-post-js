/**
 * Serviço do mapa de parceiros — BR-PARTNER-001/003. specs/api/partners.md
 */
import { label, toWhatsappUrl, safeWebsite, haversineKm, boundingBox, PARTNER_WHATSAPP_MESSAGE } from '@petspost/domain';

/** Partner da API. Site que não é http/https vira null (BR-PARTNER-002). */
export function toPartner(p, distanceKm) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    type: p.partnerType,
    typeLabel: label('partnerType', p.partnerType),
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    phone: p.phone || null,
    email: p.email || null,
    website: safeWebsite(p.website),
    whatsappUrl: p.phone ? toWhatsappUrl(p.phone, PARTNER_WHATSAPP_MESSAGE) : null,
    ...(distanceKm !== undefined && { distanceKm: Math.round(distanceKm * 10) / 10 }),
  };
}

/** @param {{ partners: ReturnType<typeof import('./repository.js').createPartnerRepository> }} deps */
export function createPartnerService({ partners }) {
  return {
    /**
     * Sem lat/lng: todos em ordem alfabética. Com lat/lng: só os do raio, do mais perto ao mais longe.
     * @param {{ type?: string, lat?: number, lng?: number, radiusKm: number }} query
     */
    async list({ type, lat, lng, radiusKm }) {
      if (lat === undefined || lng === undefined) {
        return { items: (await partners.listForMap({ type })).map((p) => toPartner(p)) };
      }
      const center = { lat, lng };
      const rows = await partners.listForMap({ type, box: boundingBox(center, radiusKm) });
      const items = rows
        .map((p) => ({ p, d: haversineKm(center, { lat: p.lat, lng: p.lng }) }))
        .filter(({ d }) => d <= radiusKm)
        .sort((a, b) => a.d - b.d)
        .map(({ p, d }) => toPartner(p, d));
      return { items };
    },
  };
}
