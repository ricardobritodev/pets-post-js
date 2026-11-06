/**
 * presenter.js — Produtos → objetos da API (specs/api/store.md).
 */
import {
  label, pickPrimaryPhoto, finalPriceCents, discountPercent, buyLink, productWhatsappMessage, toWhatsappUrl, safeWebsite, soldBy,
} from '@petspost/domain';

export function toProductCard(p) {
  const primary = pickPrimaryPhoto(p.photos);
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    categoryLabel: label('productCategory', p.category),
    petType: p.petType,
    petTypeLabel: p.petType ? label('petType', p.petType) : 'Todos os pets',
    priceCents: p.priceCents,
    promoPriceCents: p.promoPriceCents,
    finalPriceCents: finalPriceCents(p),
    discountPercent: discountPercent(p),
    inStock: p.stock > 0,
    isFeatured: p.isFeatured,
    priceCheckedAt: p.priceCheckedAt ?? null, // BR-STORE-011
    primaryPhoto: primary ? { url: primary.url } : null,
    soldBy: soldBy(p, p.partner), // BR-STORE-013 — "Vendido e entregue por"
    partner: p.partner ? { id: p.partner.id, name: p.partner.name } : null,
  };
}

export function toProductDetail(p) {
  const partner = p.partner && {
    id: p.partner.id,
    name: p.partner.name,
    type: p.partner.partnerType,
    typeLabel: label('partnerType', p.partner.partnerType),
    address: p.partner.address,
    phone: p.partner.phone || null,
    website: safeWebsite(p.partner.website),
    whatsappUrl: p.partner.phone ? toWhatsappUrl(p.partner.phone, productWhatsappMessage(p.name)) : null,
  };
  const link = buyLink(p, partner);
  return {
    ...toProductCard(p),
    description: p.description,
    stock: p.stock,
    photos: p.photos.map(({ id, url, isPrimary }) => ({ id, url, isPrimary })),
    buyUrl: link.url,
    buyChannel: link.channel,
    partner,
  };
}

/** Admin: detalhe + campos de controle. */
export const toAdminProduct = (p) => ({
  ...toProductDetail(p),
  partnerId: p.partnerId,
  url: p.url,
  sellerName: p.sellerName ?? null,
  isActive: p.isActive,
  partnerActive: p.partner?.isActive ?? false,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});
