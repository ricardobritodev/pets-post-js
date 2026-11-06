/**
 * presenter.js — Registros de adoção → objetos da API (specs/api/adoption.md).
 */
import { label, pickPrimaryPhoto, adoptionWhatsappMessage, toWhatsappUrl, canManage } from '@petspost/domain';

const primaryPhotoOf = (photos) => {
  const p = pickPrimaryPhoto(photos);
  return p ? { url: p.url } : null;
};

/** AdoptionCard — listagens. */
export function toAdoptionCard(a) {
  return {
    id: a.id,
    title: a.title,
    petName: a.petName,
    petType: a.petType,
    petTypeLabel: label('petType', a.petType),
    petSize: a.petSize,
    petSizeLabel: a.petSize ? label('petSize', a.petSize) : null,
    isNeutered: a.isNeutered,
    isVaccinated: a.isVaccinated,
    location: a.location,
    isActive: a.isActive,
    isAdopted: a.isAdopted,
    createdAt: a.createdAt,
    primaryPhoto: primaryPhotoOf(a.photos),
  };
}

/** Adoption — detalhe. */
export function toAdoptionDetail(a, viewer) {
  return {
    ...toAdoptionCard(a),
    description: a.description,
    petBreed: a.petBreed,
    petColor: a.petColor,
    adopterRequirements: a.adopterRequirements,
    locationLat: a.locationLat,
    locationLng: a.locationLng,
    contactPhone: a.contactPhone,
    contactEmail: a.contactEmail,
    updatedAt: a.updatedAt,
    owner: a.user ? { id: a.user.id, name: a.user.name } : null,
    photos: a.photos.map(({ id, url, isPrimary }) => ({ id, url, isPrimary })),
    whatsappUrl: toWhatsappUrl(a.contactPhone, adoptionWhatsappMessage(a)),
    canManage: canManage(viewer, a), // PERM-001
  };
}
