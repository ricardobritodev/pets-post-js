/**
 * geocoder.js — Endereço → coordenadas via Nominatim (OpenStreetMap). specs/api/geo.md
 *
 * Porta do app/services/geocoding.py, com duas correções:
 *   - fila de 1 requisição por segundo, como pede a política do Nominatim (BR-GEO-003);
 *   - roda em segundo plano, depois de responder ao usuário (BR-GEO-001).
 * Usa o fetch nativo do Node (sem Axios).
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
export const DEFAULT_USER_AGENT = 'PetsPost/2.0 (projeto-academico; contato: admin@petspost.com)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fila serial: cada tarefa começa pelo menos `minIntervalMs` depois do início da anterior.
 * @param {{ minIntervalMs?: number, now?: () => number, wait?: (ms: number) => Promise<void> }} [options]
 */
export function createRateQueue({ minIntervalMs = 1000, now = Date.now, wait = sleep } = {}) {
  let tail = Promise.resolve();
  let lastStart = -Infinity;
  let pending = 0;

  return {
    get pending() {
      return pending;
    },
    /** @template T @param {() => Promise<T>} task @returns {Promise<T>} */
    run(task) {
      pending += 1;
      const job = tail.then(async () => {
        const delay = lastStart + minIntervalMs - now();
        if (delay > 0) await wait(delay);
        lastStart = now();
        try {
          return await task();
        } finally {
          pending -= 1;
        }
      });
      tail = job.catch(() => {}); // erro de uma tarefa não trava a fila
      return job;
    },
    /** Espera a fila esvaziar (usado nos testes). */
    idle: () => tail,
  };
}

/**
 * @param {{
 *   fetch?: typeof fetch,
 *   userAgent?: string,
 *   timeoutMs?: number,
 *   queue?: ReturnType<typeof createRateQueue>,
 *   logger?: { warn: Function },
 * }} [options]
 */
export function createGeocoder({
  fetch: doFetch = globalThis.fetch,
  userAgent = DEFAULT_USER_AGENT,
  timeoutMs = 5000,
  queue = createRateQueue(),
  logger = console,
} = {}) {
  /** Uma consulta. Devolve { lat, lng } ou null — nunca lança (BR-GEO-001). */
  async function lookup(address) {
    const q = String(address ?? '').trim();
    if (!q) return null;
    const params = new URLSearchParams({ q, format: 'json', limit: '1', countrycodes: 'br', addressdetails: '0' });
    try {
      const res = await doFetch(`${NOMINATIM_URL}?${params}`, {
        headers: { 'User-Agent': userAgent, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        logger.warn({ status: res.status }, 'nominatim respondeu com erro');
        return null;
      }
      const [first] = await res.json();
      const lat = Number(first?.lat);
      const lng = Number(first?.lon);
      if (!first || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
      return { lat, lng };
    } catch (err) {
      logger.warn({ err: err?.name ?? String(err) }, 'geocodificação falhou');
      return null;
    }
  }

  return {
    /** Entra na fila (1/s) e devolve { lat, lng } ou null. */
    geocode: (address) => queue.run(() => lookup(address)),
    idle: () => queue.idle(),
  };
}
