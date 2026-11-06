/**
 * cep.js — Consulta de CEP no ViaCEP (BR-GEO-004). Porta da rota /api/cep do Flask.
 */

const VIACEP_URL = 'https://viacep.com.br/ws';

/** ViaCEP fora do ar, lento ou respondendo lixo. */
export class UpstreamError extends Error {}

/**
 * @param {{ fetch?: typeof fetch, timeoutMs?: number, userAgent?: string }} [options]
 */
export function createCepClient({ fetch: doFetch = globalThis.fetch, timeoutMs = 5000, userAgent = 'PetsPost/2.0 (projeto-academico)' } = {}) {
  return {
    /**
     * @param {string} digits 8 dígitos, já validados
     * @returns {Promise<{ cep: string, street: string, neighborhood: string, city: string, uf: string } | null>}
     *   null = CEP não existe
     * @throws {UpstreamError}
     */
    async lookup(digits) {
      let data;
      try {
        const res = await doFetch(`${VIACEP_URL}/${digits}/json/`, {
          headers: { 'User-Agent': userAgent, Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        // O ViaCEP responde 400 para formato inválido e 200 com { erro: true } para CEP inexistente.
        if (res.status === 400 || res.status === 404) return null;
        if (!res.ok) throw new UpstreamError(`viacep ${res.status}`);
        data = await res.json();
      } catch (err) {
        if (err instanceof UpstreamError) throw err;
        throw new UpstreamError(err?.name ?? 'falha');
      }
      if (!data || typeof data !== 'object') throw new UpstreamError('resposta inválida');
      if (data.erro) return null;
      // Só os campos que o front usa (o Flask fazia o mesmo).
      const text = (v) => (typeof v === 'string' ? v.slice(0, 120) : '');
      return {
        cep: `${digits.slice(0, 5)}-${digits.slice(5)}`,
        street: text(data.logradouro),
        neighborhood: text(data.bairro),
        city: text(data.localidade),
        uf: text(data.uf),
      };
    },
  };
}
