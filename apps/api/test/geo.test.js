/**
 * Geocodificação e CEP — BR-GEO-001..004 (sem rede: fetch falso).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateQueue, createGeocoder, DEFAULT_USER_AGENT } from '../src/lib/geocoder.js';
import { createCepClient, UpstreamError } from '../src/lib/cep.js';
import { createGeoJobs } from '../src/modules/geo/jobs.js';

const silent = { warn() {}, error() {} };
const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Relógio falso: esperar só avança o tempo. */
function fakeClock() {
  let t = 0;
  return { now: () => t, wait: async (ms) => { t += ms; } };
}

test('BR-GEO-003 fila: no máximo 1 requisição por segundo, na ordem de chegada', async () => {
  const clock = fakeClock();
  const queue = createRateQueue({ minIntervalMs: 1000, ...clock });
  const starts = [];
  const results = await Promise.all([1, 2, 3].map((n) => queue.run(async () => { starts.push([n, clock.now()]); return n; })));
  assert.deepEqual(results, [1, 2, 3]);
  assert.deepEqual(starts, [[1, 0], [2, 1000], [3, 2000]]);
  assert.equal(queue.pending, 0);
});

test('BR-GEO-003 fila: erro numa tarefa não trava as próximas', async () => {
  const queue = createRateQueue({ minIntervalMs: 0 });
  await assert.rejects(queue.run(async () => { throw new Error('x'); }), /x/);
  assert.equal(await queue.run(async () => 'ok'), 'ok');
});

test('BR-GEO-001/003 Nominatim: restrito ao Brasil, 1 resultado, User-Agent identificado', async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    return jsonResponse([{ lat: '-23.5874', lon: '-46.6576' }]);
  };
  const geocoder = createGeocoder({ fetch, queue: createRateQueue({ minIntervalMs: 0 }), logger: silent });
  assert.deepEqual(await geocoder.geocode('  Parque Ibirapuera, São Paulo  '), { lat: -23.5874, lng: -46.6576 });

  const [{ url, init }] = calls;
  assert.equal(url.origin + url.pathname, 'https://nominatim.openstreetmap.org/search');
  assert.equal(url.searchParams.get('q'), 'Parque Ibirapuera, São Paulo');
  assert.equal(url.searchParams.get('countrycodes'), 'br');
  assert.equal(url.searchParams.get('limit'), '1');
  assert.equal(url.searchParams.get('format'), 'json');
  assert.equal(init.headers['User-Agent'], DEFAULT_USER_AGENT);
  assert.ok(init.signal instanceof AbortSignal); // timeout de 5 s
});

test('BR-GEO-001 falhas viram null, sem lançar erro', async () => {
  const cases = {
    rede: async () => { throw new TypeError('fetch failed'); },
    timeout: async () => { throw new DOMException('timeout', 'TimeoutError'); },
    http500: async () => jsonResponse({}, 500),
    vazio: async () => jsonResponse([]),
    lixo: async () => jsonResponse([{ lat: 'abc', lon: '1' }]),
    foraDoMapa: async () => jsonResponse([{ lat: '123', lon: '1' }]),
  };
  for (const [name, fetch] of Object.entries(cases)) {
    const geocoder = createGeocoder({ fetch, queue: createRateQueue({ minIntervalMs: 0 }), logger: silent });
    assert.equal(await geocoder.geocode('Rua X'), null, name);
  }
  let called = false;
  const geocoder = createGeocoder({ fetch: async () => { called = true; }, queue: createRateQueue({ minIntervalMs: 0 }) });
  assert.equal(await geocoder.geocode('   '), null);
  assert.equal(called, false); // endereço vazio nem consulta
});

test('BR-GEO-002 só geocodifica se o endereço mudou ou faltam coordenadas', () => {
  const geo = createGeoJobs({ geocoder: null });
  const withCoords = { address: 'Rua A', lat: -23, lng: -46 };
  const noCoords = { address: 'Rua A', lat: null, lng: null };
  assert.equal(geo.needsGeocoding(withCoords, undefined), false); // editou outro campo
  assert.equal(geo.needsGeocoding(withCoords, 'Rua A'), false); // mandou o mesmo endereço
  assert.equal(geo.needsGeocoding(withCoords, 'Rua B'), true);
  assert.equal(geo.needsGeocoding(noCoords, undefined), true);
  assert.equal(geo.needsGeocoding(noCoords, 'Rua A'), true);
});

test('BR-GEO-004 ViaCEP: devolve só rua, bairro, cidade e UF', async () => {
  let url;
  const fetch = async (u) => {
    url = u;
    return jsonResponse({ cep: '01310-100', logradouro: 'Avenida Paulista', complemento: 'até 610', bairro: 'Bela Vista', localidade: 'São Paulo', uf: 'SP', ibge: '3550308', ddd: '11' });
  };
  const cep = createCepClient({ fetch });
  assert.deepEqual(await cep.lookup('01310100'), {
    cep: '01310-100', street: 'Avenida Paulista', neighborhood: 'Bela Vista', city: 'São Paulo', uf: 'SP',
  });
  assert.equal(url, 'https://viacep.com.br/ws/01310100/json/');
});

test('BR-GEO-004 ViaCEP: inexistente → null; fora do ar → UpstreamError', async () => {
  assert.equal(await createCepClient({ fetch: async () => jsonResponse({ erro: 'true' }) }).lookup('99999999'), null);
  assert.equal(await createCepClient({ fetch: async () => jsonResponse({}, 400) }).lookup('00000000'), null);
  for (const fetch of [
    async () => jsonResponse({}, 503),
    async () => { throw new TypeError('fetch failed'); },
    async () => new Response('<html>', { status: 200 }),
  ]) {
    await assert.rejects(createCepClient({ fetch }).lookup('01310100'), UpstreamError);
  }
});
