/**
 * config.js — Variáveis de ambiente validadas com zod.
 * Falha rápido (na inicialização) se algo obrigatório estiver faltando.
 */
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(0).max(65535).default(3000),
    DATABASE_URL: z.string().optional(),
    SESSION_SECRET: z.string().optional(),
    // Endereço público do site (og:url / og:image absolutos). Ex.: https://www.petspost.com.br
    PUBLIC_URL: z.url().optional(),
    // Pasta do build do Vite servida pelo Express (padrão em produção: apps/web/dist).
    WEB_DIST_DIR: z.string().optional(),
    // Pasta das fotos enviadas (ADR 006). Padrão: apps/api/uploads
    UPLOAD_DIR: z.string().optional(),
    // Geocodificação via Nominatim (specs/api/geo.md). Padrão: ligada, menos em NODE_ENV=test.
    GEOCODER_ENABLED: z.enum(['true', 'false']).optional(),
    GEOCODER_USER_AGENT: z.string().min(5).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (!env.DATABASE_URL) {
      ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'obrigatória em produção' });
    }
    if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
      ctx.addIssue({ code: 'custom', path: ['SESSION_SECRET'], message: 'obrigatória em produção (mín. 32 caracteres)' });
    }
  });

/** @param {NodeJS.ProcessEnv} source */
export function loadConfig(source = process.env) {
  const result = schema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuração inválida:\n${details}\nConfira o arquivo .env (veja .env.example).`);
  }
  const data = { ...result.data };
  data.GEOCODER_ENABLED = (data.GEOCODER_ENABLED ?? (data.NODE_ENV === 'test' ? 'false' : 'true')) === 'true';
  // Fora de produção, sem SESSION_SECRET: gera um aleatório (as sessões somem ao reiniciar).
  if (!data.SESSION_SECRET) {
    data.SESSION_SECRET = randomBytes(32).toString('hex');
    data.SESSION_SECRET_GENERATED = true;
  }
  return Object.freeze(data);
}
