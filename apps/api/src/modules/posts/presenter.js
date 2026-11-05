/**
 * presenter.js — Converte registros do banco nos objetos da API (specs/api/posts.md).
 */
import { label, pickPrimaryPhoto, postWhatsappMessage, toWhatsappUrl, canManage } from '@petspost/domain';

const primaryPhotoOf = (photos) => {
  const p = pickPrimaryPhoto(photos);
  return p ? { url: p.url } : null;
};

/** PostCard — listagens. */
export function toPostCard(post) {
  return {
    id: post.id,
    title: post.title,
    status: post.status,
    statusLabel: label('status', post.status),
    petName: post.petName,
    petType: post.petType,
    petTypeLabel: label('petType', post.petType),
    lastSeenLocation: post.lastSeenLocation,
    isActive: post.isActive,
    isResolved: post.isResolved,
    createdAt: post.createdAt,
    primaryPhoto: primaryPhotoOf(post.photos),
  };
}

/**
 * Post completo — detalhe.
 * @param {object} post registro com `photos` e `user`
 * @param {{ id: number, role: string }|null} viewer usuário logado
 */
export function toPostDetail(post, viewer) {
  return {
    ...toPostCard(post),
    description: post.description,
    petBreed: post.petBreed,
    petColor: post.petColor,
    petSize: post.petSize,
    petSizeLabel: post.petSize ? label('petSize', post.petSize) : null,
    lastSeenLat: post.lastSeenLat,
    lastSeenLng: post.lastSeenLng,
    contactPhone: post.contactPhone,
    contactEmail: post.contactEmail,
    reward: post.reward,
    updatedAt: post.updatedAt,
    owner: post.user ? { id: post.user.id, name: post.user.name } : null,
    photos: post.photos.map(({ id, url, isPrimary }) => ({ id, url, isPrimary })),
    whatsappUrl: toWhatsappUrl(post.contactPhone, postWhatsappMessage(post)),
    canManage: canManage(viewer, post), // PERM-001
  };
}
