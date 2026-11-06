/**
 * geo.js — CEP (BR-GEO-004). Spec: specs/api/geo.md
 */
import { z } from 'zod';

/** BR-GEO-004 — 8 dígitos; máscara e outros caracteres são ignorados. Devolve só os dígitos. */
export const cepSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((d) => d.length === 8, { message: 'CEP inválido. Use 8 dígitos (ex.: 01310-100).' });
