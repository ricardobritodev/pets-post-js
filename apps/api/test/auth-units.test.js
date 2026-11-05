// Unitário (sem banco): middlewares de autorização, validação, store e log.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { requireAuth, requireAdmin, loadUser } from '../src/middleware/auth.js';
import { validate } from '../src/middleware/validate.js';
import { expiresAtOf } from '../src/lib/session-store.js';
import { createSecurityLog } from '../src/lib/security-log.js';
import { toPublicUser } from '../src/modules/auth/service.js';

/** Roda um middleware e devolve o que foi passado para next(). */
const run = async (mw, req) => {
  let out = 'not-called';
  await mw(req, {}, (err) => (out = err ?? null));
  return out;
};

test('requireAuth: visitante → 401; logado → segue', async () => {
  assert.equal((await run(requireAuth, { user: null })).status, 401);
  assert.equal(await run(requireAuth, { user: { id: 1 } }), null);
});

test('PERM-003 requireAdmin: visitante 401, usuário 403, admin segue', async () => {
  assert.equal((await run(requireAdmin, { user: null })).status, 401);
  const forbidden = await run(requireAdmin, { user: { id: 1, role: 'user' } });
  assert.deepEqual([forbidden.status, forbidden.code], [403, 'FORBIDDEN']);
  assert.equal(await run(requireAdmin, { user: { id: 9, role: 'admin' } }), null);
});

test('PERM-004 loadUser: usuário inativo é retirado da sessão', async () => {
  const users = { findById: async (id) => ({ id, isActive: false }) };
  const req = { session: { userId: 5 } };
  await run(loadUser({ users }), req);
  assert.equal(req.user, null);
  assert.equal('userId' in req.session, false);
});

test('loadUser: sem userId não consulta o banco', async () => {
  const users = { findById: async () => assert.fail('não deveria consultar') };
  const req = { session: {} };
  await run(loadUser({ users }), req);
  assert.equal(req.user, null);
});

test('validate: erro vira 400 VALIDATION_ERROR com details; sucesso normaliza o body', async () => {
  const schema = z.object({ email: z.string().trim().toLowerCase().email('Email inválido.') });
  const bad = await run(validate(schema), { body: { email: 'x' } });
  assert.deepEqual([bad.status, bad.code, bad.details], [400, 'VALIDATION_ERROR', [{ path: 'email', message: 'Email inválido.' }]]);
  const req = { body: { email: ' A@B.COM ' } };
  assert.equal(await run(validate(schema), req), null);
  assert.equal(req.body.email, 'a@b.com');
});

test('BR-AUTH-008 expiresAtOf usa o cookie; sem cookie, 2 h', () => {
  const now = Date.parse('2026-11-05T12:00:00Z');
  assert.equal(expiresAtOf({ cookie: { expires: '2026-11-06T00:00:00.000Z' } }, now).toISOString(), '2026-11-06T00:00:00.000Z');
  assert.equal(expiresAtOf({ cookie: { originalMaxAge: 1000 } }, now).getTime(), now + 1000);
  assert.equal(expiresAtOf({}, now).getTime(), now + 2 * 3600 * 1000);
});

test('BR-AUTH-011 log de segurança aceita só eventos conhecidos e usa warn nas falhas', () => {
  const calls = [];
  const fake = { child: () => ({ info: (o) => calls.push(['info', o.event]), warn: (o) => calls.push(['warn', o.event]) }) };
  const log = createSecurityLog(fake);
  log('login_success', { ip: '1.1.1.1' });
  log('login_failed', { ip: '1.1.1.1' });
  assert.deepEqual(calls, [['info', 'login_success'], ['warn', 'login_failed']]);
  assert.throws(() => log('evento_qualquer'), /desconhecido/);
});

test('toPublicUser nunca inclui passwordHash nem campos internos', () => {
  const pub = toPublicUser({ id: 1, name: 'A', email: 'a@b.com', role: 'user', phone: undefined, passwordHash: 'x', isActive: true });
  assert.deepEqual(pub, { id: 1, name: 'A', email: 'a@b.com', role: 'user', phone: null });
});
