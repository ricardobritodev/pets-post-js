/**
 * constants.js — Enumerações e rótulos do domínio.
 * Spec: specs/domain/entities.md
 */

export const USER_ROLES = Object.freeze(['admin', 'user']);
export const POST_STATUSES = Object.freeze(['lost', 'found']);
export const PET_TYPES = Object.freeze(['dog', 'cat', 'bird', 'other']);
export const PET_SIZES = Object.freeze(['small', 'medium', 'large']);
export const PARTNER_TYPES = Object.freeze(['foster_home', 'petshop', 'vet_clinic']);
/** BR-STORE-002 — categorias da loja. */
export const PRODUCT_CATEGORIES = Object.freeze(['food', 'treats', 'toys', 'hygiene', 'health', 'accessories', 'beds']);

export const LABELS = Object.freeze({
  status: { lost: 'Perdido', found: 'Encontrado' },
  petType: { dog: 'Cachorro', cat: 'Gato', bird: 'Pássaro', other: 'Outro' },
  petSize: { small: 'Pequeno', medium: 'Médio', large: 'Grande' },
  partnerType: {
    foster_home: 'Lar Temporário',
    petshop: 'Petshop Parceiro',
    vet_clinic: 'Clínica Veterinária',
  },
  productCategory: {
    food: 'Ração',
    treats: 'Petiscos',
    toys: 'Brinquedos',
    hygiene: 'Higiene e beleza',
    health: 'Farmácia e saúde',
    accessories: 'Coleiras e acessórios',
    beds: 'Camas e casinhas',
  },
});

/** Rótulo legível; devolve o próprio valor se não houver tradução. */
export function label(group, value) {
  if (value == null || value === '') return '';
  return LABELS[group]?.[value] ?? value;
}

/** Política de fotos — BR-PHOTO-001..005. */
export const PHOTO_POLICY = Object.freeze({
  maxPerPost: 6,
  allowedExtensions: Object.freeze(['png', 'jpg', 'jpeg', 'gif', 'webp']),
  maxRequestBytes: 8 * 1024 * 1024,
  maxPixels: 20_000_000,
  maxWidth: 800,
  quality: 85,
});

/** Paginação das listagens públicas — BR-POST-003. */
export const PAGE_SIZE = 12;

/** Regex de telefone (formato com máscara) — BR-VAL-001. */
export const PHONE_REGEX = /^\(\d{2}\) \d{4,5}-\d{4}$/;

/** Senha mínima — BR-AUTH-002. */
export const PASSWORD_MIN_LENGTH = 8;
