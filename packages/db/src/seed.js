/**
 * seed.js — Funções de seed idempotentes (podem rodar várias vezes).
 *
 * Cada função recebe o client Prisma por parâmetro (testável) e pula registros
 * cuja chave natural já existe — mesmo critério dos seeds do Flask:
 *   users → email · pet_posts / adoption_posts → title · partners → name
 *
 * @typedef {{ created: number, skipped: number }} SeedResult
 */
import { hashPassword } from '@petspost/domain';

/** BR-DATA-002: o seed de desenvolvimento (senhas conhecidas) nunca roda em produção. */
export function assertDevSeedAllowed(env = process.env) {
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'BR-DATA-002: o seed de desenvolvimento não pode rodar em produção. Para parceiros reais use: npm run db:seed:partners',
    );
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} db
 * @param {Array<{ name: string, email: string, password: string, role?: 'admin'|'user', phone?: string }>} list
 * @returns {Promise<SeedResult>}
 */
export async function seedUsers(db, list) {
  const result = { created: 0, skipped: 0 };
  for (const { password, ...data } of list) {
    const email = data.email.toLowerCase();
    if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
      result.skipped++;
      continue;
    }
    await db.user.create({ data: { ...data, email, passwordHash: await hashPassword(password) } });
    result.created++;
  }
  return result;
}

/** Troca `ownerEmail` por `userId`; falha se o dono não existir. */
async function resolveOwner(db, { ownerEmail, ...data }) {
  const owner = await db.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (!owner) throw new Error(`Seed: usuário dono "${ownerEmail}" não encontrado (rode seedUsers antes).`);
  return { ...data, userId: owner.id };
}

/**
 * @param {import('@prisma/client').PrismaClient} db
 * @param {'petPost'|'adoptionPost'} model
 * @param {Array<{ ownerEmail: string, title: string }>} list
 * @returns {Promise<SeedResult>}
 */
async function seedOwnedPosts(db, model, list) {
  const result = { created: 0, skipped: 0 };
  for (const item of list) {
    if (await db[model].findFirst({ where: { title: item.title }, select: { id: true } })) {
      result.skipped++;
      continue;
    }
    await db[model].create({ data: await resolveOwner(db, item) });
    result.created++;
  }
  return result;
}

export const seedPetPosts = (db, list) => seedOwnedPosts(db, 'petPost', list);
export const seedAdoptionPosts = (db, list) => seedOwnedPosts(db, 'adoptionPost', list);

/**
 * @param {import('@prisma/client').PrismaClient} db
 * @param {Array<{ name: string }>} list
 * @returns {Promise<SeedResult>}
 */
export async function seedPartners(db, list) {
  const result = { created: 0, skipped: 0 };
  for (const data of list) {
    if (await db.partner.findFirst({ where: { name: data.name }, select: { id: true } })) {
      result.skipped++;
      continue;
    }
    await db.partner.create({ data });
    result.created++;
  }
  return result;
}

/**
 * Produtos da loja (Etapa 7b). Chave natural: `products.name`. O parceiro vem pelo nome
 * (`partnerName`); se ele não existir, o produto é pulado.
 * @param {import('@prisma/client').PrismaClient} db
 * @param {Array<{ name: string, partnerName: string }>} list
 * @returns {Promise<SeedResult>}
 */
export async function seedProducts(db, list) {
  const result = { created: 0, skipped: 0 };
  for (const { partnerName, ...data } of list) {
    const partner = await db.partner.findFirst({ where: { name: partnerName }, select: { id: true } });
    if (!partner || (await db.product.findFirst({ where: { name: data.name }, select: { id: true } }))) {
      result.skipped++;
      continue;
    }
    await db.product.create({ data: { ...data, partnerId: partner.id } });
    result.created++;
  }
  return result;
}

/** Formata um SeedResult para log: "users: 4 criados, 0 já existiam". */
export const formatResult = (label, { created, skipped }) =>
  `  ${label}: ${created} criado(s), ${skipped} já existia(m)`;
