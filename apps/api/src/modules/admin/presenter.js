/**
 * presenter.js — Objetos do painel admin (specs/api/admin.md).
 */
import { label } from '@petspost/domain';
import { toPostCard } from '../posts/presenter.js';
import { toAdoptionCard } from '../adoption/presenter.js';

const owner = (u) => (u ? { id: u.id, name: u.name, email: u.email } : null);

export const toAdminUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  isActive: u.isActive,
  createdAt: u.createdAt,
  postCount: u._count?.posts ?? 0,
  adoptionCount: u._count?.adoptionPosts ?? 0,
});

export const toAdminPost = (p) => ({ ...toPostCard(p), owner: owner(p.user) });
export const toAdminAdoption = (a) => ({ ...toAdoptionCard(a), owner: owner(a.user) });

/** Parceiro com tudo (o admin vê inclusive o site como foi cadastrado). */
export const toAdminPartner = (p) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  type: p.partnerType,
  typeLabel: label('partnerType', p.partnerType),
  address: p.address,
  lat: p.lat,
  lng: p.lng,
  phone: p.phone,
  email: p.email,
  website: p.website,
  isActive: p.isActive,
  createdAt: p.createdAt,
});
