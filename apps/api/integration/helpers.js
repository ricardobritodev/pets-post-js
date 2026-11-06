/**
 * helpers.js — Utilitários dos testes de integração da API.
 * (não termina em .int.js, então o node --test não executa como teste)
 */
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

/** Sobe a app numa porta livre. Devolve { base, close, events }. */
export async function startApp({ db, limits, storage, geocoder, cep, importer, configOverrides = {} } = {}) {
  const config = loadConfig({ NODE_ENV: 'test', SESSION_SECRET: 'x'.repeat(40), ...configOverrides });
  const events = [];
  const securityLog = (event, fields) => events.push({ event, ...fields });
  const app = createApp({ config, db, securityLog, limits, storage, geocoder, cep, importer });
  const server = app.listen(0);
  // Com --test-name-pattern o node pode rodar o before() e pular o after(): sem unref, o
  // servidor aberto segura o processo e o teste nunca termina.
  server.unref();
  await new Promise((r) => server.once('listening', r));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    events,
    geo: app.locals.geo, // geo.idle(): espera a geocodificação em segundo plano
    close: () => new Promise((r) => server.close(r)),
  };
}

/** Cliente com "pote de cookies" e token CSRF, como um navegador faria. */
export function createClient(base) {
  const jar = new Map();
  const client = {
    csrfToken: null,
    cookies: jar,
    lastSetCookies: [],

    async request(method, path, { json, form, csrf = true, headers = {} } = {}) {
      const h = { accept: 'application/json', ...headers };
      if (jar.size) h.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
      if (json !== undefined) h['content-type'] = 'application/json';
      if (csrf && client.csrfToken && method !== 'GET') h['x-csrf-token'] = client.csrfToken;

      const res = await fetch(`${base}/api/v1${path}`, {
        method,
        headers: h,
        body: form ?? (json !== undefined ? JSON.stringify(json) : undefined), // FormData: o fetch monta o multipart
      });
      client.lastSetCookies = res.headers.getSetCookie();
      for (const c of client.lastSetCookies) {
        const [pair] = c.split(';');
        const i = pair.indexOf('=');
        const name = pair.slice(0, i);
        const value = pair.slice(i + 1);
        if (/max-age=0|expires=thu, 01 jan 1970/i.test(c)) jar.delete(name);
        else jar.set(name, value);
      }
      const body = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
      if (body?.csrfToken) client.csrfToken = body.csrfToken;
      return { status: res.status, body, headers: res.headers };
    },

    get: (path, opts) => client.request('GET', path, opts),
    post: (path, json, opts) => client.request('POST', path, { ...opts, json }),
    patch: (path, json, opts) => client.request('PATCH', path, { ...opts, json }),
    del: (path, opts) => client.request('DELETE', path, opts),
    upload: (path, form, opts) => client.request('POST', path, { ...opts, form }),

    /** Atalho: pega o token CSRF e loga. */
    async loginAs(email, password = 'Senha@123') {
      await client.init();
      const res = await client.post('/auth/login', { email, password });
      if (res.status !== 200) throw new Error(`login falhou: ${res.status}`);
      return client;
    },

    /** Pega o token CSRF (cria a sessão anônima). */
    async init() {
      await client.get('/auth/csrf');
      return client;
    },
  };
  return client;
}

export const BIG_LIMIT = { perMinute: 10_000, perHour: 10_000 };
export const LOOSE_LIMITS = { login: BIG_LIMIT, register: BIG_LIMIT, csrf: BIG_LIMIT, upload: BIG_LIMIT, cep: BIG_LIMIT, import: BIG_LIMIT };

export const validUser = (over = {}) => ({
  name: 'Maria Silva',
  email: 'maria@exemplo.com',
  phone: '(11) 98765-4321',
  password: 'Senha@123',
  confirmPassword: 'Senha@123',
  ...over,
});
