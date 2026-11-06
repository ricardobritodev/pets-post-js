/**
 * rate-limit.js — Limite de requisições por IP (BR-AUTH-007).
 *
 * Store em memória: vale por processo. Com mais de uma instância da API (Etapa 7),
 * trocar por um store compartilhado (ex.: rate-limit-redis).
 */
import { rateLimit } from 'express-rate-limit';

/** Limites padrão da spec. Os testes podem sobrescrever via createApp({ limits }). */
export const DEFAULT_LIMITS = Object.freeze({
  login: { perMinute: 10, perHour: 50 },
  register: { perMinute: 5, perHour: 20 },
  // GET /auth/csrf grava uma sessão anônima: limitar evita lotar a tabela `sessions`.
  csrf: { perMinute: 30, perHour: 300 },
  // Re-codificar imagem gasta CPU: limita os envios de fotos.
  upload: { perMinute: 20, perHour: 200 },
  // BR-GEO-004 — consulta de CEP (cada uma vira uma chamada ao ViaCEP).
  cep: { perMinute: 30, perHour: 300 },
});

const json429 = (_req, res) =>
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Aguarde um pouco e tente de novo.' } });

/** Dois limitadores encadeados: por minuto e por hora. */
export function limitPerIp({ perMinute, perHour }) {
  const make = (windowMs, limit) =>
    rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, handler: json429 });
  return [make(60_000, perMinute), make(3_600_000, perHour)];
}
