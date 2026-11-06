/**
 * partners.js — Query do mapa de parceiros. Spec: specs/api/partners.md · BR-PARTNER-001/003
 */
import { z } from 'zod';
import { PARTNER_TYPES } from '@petspost/domain';
import { lenientEnum } from './common.js';

const coord = (max, name) =>
  z.coerce.number({ message: `${name} inválida.` }).min(-max, `${name} inválida.`).max(max, `${name} inválida.`);

/** BR-PARTNER-003 — `lat` e `lng` juntos; raio de 1 a 100 km (padrão 10). */
export const partnersQuerySchema = z
  .object({
    type: lenientEnum(PARTNER_TYPES),
    lat: coord(90, 'Latitude').optional(),
    lng: coord(180, 'Longitude').optional(),
    radiusKm: z.coerce.number().min(1, 'Raio mínimo de 1 km.').max(100, 'Raio máximo de 100 km.').optional().default(10),
  })
  .refine((q) => (q.lat === undefined) === (q.lng === undefined), {
    message: 'Informe latitude e longitude juntas.',
    path: ['lat'],
  });
