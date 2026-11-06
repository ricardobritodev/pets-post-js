/**
 * jobs.js — Geocodificação em segundo plano (BR-GEO-001/002/003), usada por posts e adoção.
 *
 * `schedule` não espera nada: a API responde e o endereço entra na fila do geocoder.
 * Quem chama passa `save`, que grava as coordenadas só se o endereço ainda for o mesmo
 * (a pessoa pode ter editado ou excluído o anúncio enquanto a fila andava).
 */

/**
 * @param {{
 *   geocoder: ReturnType<typeof import('../../lib/geocoder.js').createGeocoder> | null,
 *   logger?: { warn: Function, error: Function },
 * }} deps geocoder null = desligado (GEOCODER_ENABLED=false)
 */
export function createGeoJobs({ geocoder, logger = console }) {
  const running = new Set();

  return {
    enabled: Boolean(geocoder),

    /**
     * BR-GEO-001 — dispara e esquece. Erros só vão para o log.
     * @param {string} address
     * @param {(coords: { lat: number, lng: number }) => Promise<unknown>} save
     */
    schedule(address, save) {
      if (!geocoder) return;
      const p = geocoder
        .geocode(address)
        .then((coords) => coords && save(coords)) // sem resultado: fica sem coordenadas
        .catch((err) => logger.error({ err }, 'erro ao gravar coordenadas'))
        .finally(() => running.delete(p));
      running.add(p);
    },

    /**
     * BR-GEO-002 — precisa geocodificar? Só se o endereço mudou ou ainda não há coordenadas.
     * @param {{ address: string, lat: number|null, lng: number|null }} before
     * @param {string|undefined} newAddress
     */
    needsGeocoding(before, newAddress) {
      if (newAddress !== undefined && newAddress !== before.address) return true;
      return before.lat == null || before.lng == null;
    },

    /** Espera os trabalhos em andamento (testes e desligamento). */
    idle: () => Promise.all([...running]),
  };
}
