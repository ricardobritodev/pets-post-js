/**
 * Rota /api/v1/cep/:cep — BR-GEO-004 · specs/api/geo.md
 */
import { Router } from 'express';
import { cepSchema } from '@petspost/contracts';
import { HttpError } from '../../middleware/errors.js';
import { limitPerIp } from '../../middleware/rate-limit.js';
import { UpstreamError } from '../../lib/cep.js';

/**
 * @param {{
 *   cep: ReturnType<typeof import('../../lib/cep.js').createCepClient>,
 *   limits: typeof import('../../middleware/rate-limit.js').DEFAULT_LIMITS,
 * }} deps
 */
export function cepRouter({ cep, limits }) {
  const router = Router();

  router.get('/:cep', ...limitPerIp(limits.cep), async (req, res) => {
    const parsed = cepSchema.safeParse(req.params.cep);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0].message, [
        { path: 'cep', message: parsed.error.issues[0].message },
      ]);
    }
    let address;
    try {
      address = await cep.lookup(parsed.data);
    } catch (err) {
      if (err instanceof UpstreamError) {
        throw new HttpError(502, 'UPSTREAM_ERROR', 'Serviço de CEP indisponível. Preencha o endereço à mão.');
      }
      throw err;
    }
    if (!address) throw new HttpError(404, 'NOT_FOUND', 'CEP não encontrado.');
    // Endereço de um CEP quase não muda: o navegador pode guardar por 1 dia.
    res.set('Cache-Control', 'public, max-age=86400');
    res.json(address);
  });

  return router;
}
