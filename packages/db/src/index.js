/**
 * @petspost/db — client Prisma compartilhado (singleton).
 *
 * Em desenvolvimento, o `node --watch` recarrega módulos; guardar a
 * instância em globalThis evita abrir várias conexões com o MySQL.
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__petspostPrisma ??
  new PrismaClient({
    // Em teste, erros esperados (ex.: P2002 de email duplicado) não poluem a saída.
    log: { development: ['warn', 'error'], test: [] }[process.env.NODE_ENV] ?? ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__petspostPrisma = prisma;
}

export * from '@prisma/client';
