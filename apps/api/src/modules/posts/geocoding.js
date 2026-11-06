/**
 * geocoding.js — Coordenadas dos posts em segundo plano (BR-GEO-001/002/003).
 *
 * `schedule` não espera nada: a API responde e o endereço entra na fila do geocoder.
 * Quando o resultado chega, só grava se o endereço do post ainda for o mesmo, porque a
 * pessoa pode ter editado no meio do caminho (ou excluído o post).
 */

/**
 * @param {{
 *   geocoder: ReturnType<typeof import('../../lib/geocoder.js').createGeocoder> | null,
 *   posts: ReturnType<typeof import('./repository.js').createPostRepository>,
 *   logger?: { warn: Function, error: Function },
 * }} deps geocoder null = desligado (GEOCODER_ENABLED=false)
 */
export function createPostGeocoding({ geocoder, posts, logger = console }) {
  const running = new Set();

  async function job(postId, address) {
    const coords = await geocoder.geocode(address);
    if (!coords) return; // BR-GEO-001: fica sem coordenadas
    await posts.setCoordsIfAddress(postId, address, coords);
  }

  return {
    enabled: Boolean(geocoder),

    /** BR-GEO-001 — dispara e esquece. Erros só vão para o log. */
    schedule(postId, address) {
      if (!geocoder) return;
      const p = job(postId, address)
        .catch((err) => logger.error({ err, postId }, 'erro ao gravar coordenadas'))
        .finally(() => running.delete(p));
      running.add(p);
    },

    /**
     * BR-GEO-002 — precisa geocodificar? Só se o endereço mudou ou ainda não há coordenadas.
     * @param {{ lastSeenLocation: string, lastSeenLat: number|null, lastSeenLng: number|null }} before
     * @param {string|undefined} newAddress
     */
    needsGeocoding(before, newAddress) {
      if (newAddress !== undefined && newAddress !== before.lastSeenLocation) return true;
      return before.lastSeenLat == null || before.lastSeenLng == null;
    },

    /** Espera os trabalhos em andamento (testes e desligamento). */
    idle: () => Promise.all([...running]),
  };
}
