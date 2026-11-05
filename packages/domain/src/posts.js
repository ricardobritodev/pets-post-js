/**
 * posts.js — Regras puras de apresentação de posts.
 * Spec: specs/api/posts.md · BR-PHOTO-002, BR-CONTACT-001
 */
import { label } from './constants.js';

/**
 * BR-PHOTO-002 — foto principal: a marcada como principal; sem marcação, a primeira
 * (em ordem de envio). Sem fotos → null.
 * @template {{ id: number, isPrimary?: boolean }} P
 * @param {P[]|null|undefined} photos
 * @returns {P|null}
 */
export function pickPrimaryPhoto(photos) {
  if (!photos?.length) return null;
  const ordered = [...photos].sort((a, b) => a.id - b.id);
  return ordered.find((p) => p.isPrimary) ?? ordered[0];
}

/**
 * Mensagem pré-preenchida do WhatsApp no detalhe do post (igual à do sistema antigo).
 * @param {{ status: string, petName?: string|null, petType: string }} post
 */
export function postWhatsappMessage(post) {
  const who = post.petName || label('petType', post.petType);
  return `Olá! Vi seu anúncio no Pets Post:\n*${label('status', post.status)} — ${who}*\nGostaria de saber mais informações. 🐾`;
}
