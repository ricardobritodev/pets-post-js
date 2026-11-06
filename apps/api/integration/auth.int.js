// Integração: rotas /api/v1/auth contra MySQL real — specs/api/auth.md
// Inclui a porta dos casos de pets-post/tests/test_auth.py.
import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@petspost/db';
import { clearDatabase } from '@petspost/db/testing';
import { hashPassword, verifyPassword } from '@petspost/domain';
import { startApp, createClient, validUser } from './helpers.js';
import { SESSION_COOKIE } from '../src/middleware/session.js';

// Limites altos aqui; o rate limit tem um teste próprio com limites baixos.
const BIG = { perMinute: 1000, perHour: 1000 };
const LOOSE = { login: BIG, register: BIG, csrf: BIG };
let app;
before(async () => {
  app = await startApp({ db: prisma, limits: LOOSE });
});
after(async () => {
  await app?.close(); // com --test-name-pattern o before pode nem rodar
  await prisma.$disconnect();
});
beforeEach(async () => {
  await clearDatabase(prisma);
  app.events.length = 0;
});

const client = () => createClient(app.base).init();
const createUser = async (over = {}) =>
  prisma.user.create({
    data: { name: 'Carlos', email: 'carlos@exemplo.com', passwordHash: await hashPassword('Senha@123'), ...over },
  });
const login = (c, email = 'carlos@exemplo.com', password = 'Senha@123', extra = {}) =>
  c.post('/auth/login', { email, password, ...extra });

describe('CSRF (BR-AUTH-012)', () => {
  test('BR-AUTH-012 POST sem token CSRF → 403 CSRF_INVALID', async () => {
    const c = await client();
    const res = await c.post('/auth/register', validUser(), { csrf: false });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'CSRF_INVALID');
    assert.equal(await prisma.user.count(), 0);
  });

  test('BR-AUTH-012 token de outra sessão não vale', async () => {
    const a = await client();
    const b = await client();
    b.csrfToken = a.csrfToken;
    assert.equal((await b.post('/auth/register', validUser())).status, 403);
  });

  test('GET /auth/csrf devolve token e cookie de sessão HttpOnly', async () => {
    const c = createClient(app.base);
    const res = await c.get('/auth/csrf');
    assert.equal(res.status, 200);
    assert.ok(res.body.csrfToken.length > 20);
    const sid = c.lastSetCookies.find((s) => s.startsWith(`${SESSION_COOKIE}=`));
    assert.match(sid, /HttpOnly/i);
    assert.match(sid, /SameSite=Lax/i);
  });
});

describe('POST /auth/register', () => {
  test('BR-AUTH-001 cria usuário (test_register_creates_user) com email normalizado e sem expor hash', async () => {
    const c = await client();
    const res = await c.post('/auth/register', validUser({ email: '  Maria@Exemplo.COM ', name: '  Maria Silva ' }));
    assert.equal(res.status, 201);
    assert.deepEqual(res.body.user, {
      id: res.body.user.id,
      name: 'Maria Silva',
      email: 'maria@exemplo.com',
      role: 'user',
      phone: '(11) 98765-4321',
    });
    const db = await prisma.user.findUnique({ where: { email: 'maria@exemplo.com' } });
    assert.match(db.passwordHash, /^scrypt:32768:8:1\$/); // BR-AUTH-004
    assert.equal(await verifyPassword(db.passwordHash, 'Senha@123'), true);
  });

  test('BR-AUTH-001 cadastro não loga automaticamente', async () => {
    const c = await client();
    await c.post('/auth/register', validUser());
    assert.equal((await c.get('/auth/me')).status, 401);
  });

  test('BR-AUTH-001 telefone vazio vira null', async () => {
    const c = await client();
    const res = await c.post('/auth/register', validUser({ phone: '' }));
    assert.equal(res.status, 201);
    assert.equal(res.body.user.phone, null);
  });

  test('BR-AUTH-001 email duplicado → 409 (test_register_duplicate_email)', async () => {
    await createUser({ email: 'maria@exemplo.com' });
    const c = await client();
    const res = await c.post('/auth/register', validUser({ email: 'MARIA@exemplo.com' }));
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CONFLICT');
    assert.match(res.body.error.message, /já está cadastrado/);
  });

  test('BR-AUTH-002 senha curta → 400 com detalhe no campo password', async () => {
    const c = await client();
    const res = await c.post('/auth/register', validUser({ password: 'curta', confirmPassword: 'curta' }));
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.details.some((d) => d.path === 'password'));
  });

  test('BR-AUTH-003 senhas diferentes → 400 em confirmPassword (test_register_password_mismatch)', async () => {
    const c = await client();
    const res = await c.post('/auth/register', validUser({ confirmPassword: 'Outra@123' }));
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.error.details, [{ path: 'confirmPassword', message: 'As senhas não coincidem.' }]);
  });

  test('BR-VAL-001 telefone fora do formato → 400', async () => {
    const c = await client();
    const res = await c.post('/auth/register', validUser({ phone: '11987654321' }));
    assert.equal(res.status, 400);
    assert.ok(res.body.error.details.some((d) => d.path === 'phone'));
  });
});

describe('POST /auth/login', () => {
  test('login com sucesso abre sessão (test_login_success)', async () => {
    await createUser();
    const c = await client();
    const res = await login(c);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'carlos@exemplo.com');
    assert.equal('passwordHash' in res.body.user, false);
    const me = await c.get('/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.user.name, 'Carlos');
  });

  test('BR-AUTH-006 senha errada e email inexistente → mesma resposta genérica', async () => {
    await createUser();
    const wrong = await login(await client(), 'carlos@exemplo.com', 'Errada@123');
    const none = await login(await client(), 'ninguem@exemplo.com', 'Senha@123');
    for (const res of [wrong, none]) {
      assert.equal(res.status, 401);
      assert.deepEqual(res.body, {
        error: { code: 'INVALID_CREDENTIALS', message: 'Email ou senha incorretos. Tente novamente.' },
      });
    }
  });

  test('BR-AUTH-005 conta inativa com senha certa → 403; com senha errada → 401 genérico', async () => {
    await createUser({ isActive: false });
    const ok = await login(await client());
    assert.equal(ok.status, 403);
    assert.equal(ok.body.error.code, 'ACCOUNT_INACTIVE');
    assert.match(ok.body.error.message, /desativada/);
    const wrong = await login(await client(), 'carlos@exemplo.com', 'Errada@123');
    assert.equal(wrong.status, 401); // não revela que a conta existe e está inativa
  });

  test('BR-AUTH-004 hash legado pbkdf2 do sistema antigo loga e é regravado em scrypt', async () => {
    // vetor gerado pelo Werkzeug 3.1.3 (senha "Senha@123")
    const legacy = 'pbkdf2:sha256:260000$KdC5MfIkmMDVXRgU$25cd0692d8ca36c511be1045b3fdfaf69f42ea254eed11210d7349b84b23fa61';
    await prisma.user.create({ data: { name: 'Antigo', email: 'legado@exemplo.com', passwordHash: legacy } });
    const res = await login(await client(), 'legado@exemplo.com', 'Senha@123');
    assert.equal(res.status, 200);
    const { passwordHash } = await prisma.user.findUnique({ where: { email: 'legado@exemplo.com' } });
    assert.match(passwordHash, /^scrypt:32768:8:1\$/);
    assert.equal(await verifyPassword(passwordHash, 'Senha@123'), true);
  });

  test('BR-AUTH-004 hash scrypt atual não é regravado', async () => {
    const { passwordHash } = await createUser();
    await login(await client());
    assert.equal((await prisma.user.findUnique({ where: { email: 'carlos@exemplo.com' } })).passwordHash, passwordHash);
  });

  test('BR-AUTH-013 login troca o ID da sessão e o token CSRF antigo deixa de valer', async () => {
    await createUser();
    const c = await client();
    const sidBefore = c.cookies.get(SESSION_COOKIE);
    const tokenBefore = c.csrfToken;
    await login(c);
    assert.notEqual(c.cookies.get(SESSION_COOKIE), sidBefore);
    assert.notEqual(c.csrfToken, tokenBefore);

    c.csrfToken = tokenBefore;
    assert.equal((await c.post('/auth/logout')).status, 403);
  });

  test('BR-AUTH-008 sem "lembrar": cookie de 2 h; com "lembrar": 7 dias', async () => {
    await createUser();
    // express-session manda "Expires=<data>"; mede quantos segundos faltam.
    const ttl = (c) => {
      const cookie = c.lastSetCookies.find((s) => s.startsWith(SESSION_COOKIE));
      return (Date.parse(/Expires=([^;]+)/i.exec(cookie)[1]) - Date.now()) / 1000;
    };
    const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 5, `${actual} ≠ ${expected}`);
    const a = await client();
    await login(a);
    near(ttl(a), 2 * 60 * 60);
    const b = await client();
    await login(b, undefined, undefined, { remember: true });
    near(ttl(b), 7 * 24 * 60 * 60);
    // a sessão no banco expira junto com o cookie
    const row = await prisma.session.findFirst({ where: { userId: { not: null } }, orderBy: { expiresAt: 'desc' } });
    assert.ok(row.expiresAt.getTime() > Date.now() + 6 * 24 * 3600 * 1000);
  });

  test('BR-AUTH-008 sessão é gravada no banco com o userId', async () => {
    const u = await createUser();
    await login(await client());
    assert.equal(await prisma.session.count({ where: { userId: u.id } }), 1);
  });
});

describe('logout e /me', () => {
  test('BR-AUTH-010 logout exige CSRF', async () => {
    await createUser();
    const c = await client();
    await login(c);
    assert.equal((await c.post('/auth/logout', undefined, { csrf: false })).status, 403);
    assert.equal((await c.get('/auth/me')).status, 200);
  });

  test('BR-AUTH-013 logout destrói a sessão no banco (test_logout_redirects)', async () => {
    const u = await createUser();
    const c = await client();
    await login(c);
    const res = await c.post('/auth/logout');
    assert.equal(res.status, 200);
    assert.ok(res.body.csrfToken);
    assert.equal(await prisma.session.count({ where: { userId: u.id } }), 0);
    assert.equal((await c.get('/auth/me')).status, 401);
  });

  test('logout sem estar logado → 401', async () => {
    const res = await (await client()).post('/auth/logout');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHENTICATED');
  });

  test('GET /auth/me sem sessão → 401', async () => {
    assert.equal((await createClient(app.base).get('/auth/me')).status, 401);
  });

  test('PERM-004 conta desativada depois do login perde o acesso', async () => {
    const u = await createUser();
    const c = await client();
    await login(c);
    await prisma.user.update({ where: { id: u.id }, data: { isActive: false } });
    assert.equal((await c.get('/auth/me')).status, 401);
  });
});

describe('BR-AUTH-011 log de segurança', () => {
  test('BR-AUTH-011 registra os eventos com IP e nunca a senha', async () => {
    await (await client()).post('/auth/register', validUser());
    await login(await client(), 'maria@exemplo.com', 'Errada@123');
    const c = await client();
    await login(c, 'maria@exemplo.com', 'Senha@123');
    await c.post('/auth/logout');
    await prisma.user.update({ where: { email: 'maria@exemplo.com' }, data: { isActive: false } });
    await login(await client(), 'maria@exemplo.com', 'Senha@123');

    assert.deepEqual(
      app.events.map((e) => e.event),
      ['register_success', 'login_failed', 'login_success', 'logout', 'login_blocked_inactive'],
    );
    for (const e of app.events) assert.ok(e.ip, `${e.event} sem IP`);
    assert.doesNotMatch(JSON.stringify(app.events), /Senha@123|Errada@123/);
  });
});

describe('BR-AUTH-007 rate limit', () => {
  test('BR-AUTH-007 login acima do limite por minuto → 429 RATE_LIMITED', async () => {
    const strict = await startApp({
      db: prisma,
      limits: { login: { perMinute: 2, perHour: 50 }, register: { perMinute: 5, perHour: 20 }, csrf: BIG },
    });
    try {
      const c = await createClient(strict.base).init();
      const statuses = [];
      for (let i = 0; i < 3; i++) statuses.push((await login(c, 'x@exemplo.com', 'Errada@123')).status);
      assert.deepEqual(statuses, [401, 401, 429]);
      const res = await login(c, 'x@exemplo.com', 'Errada@123');
      assert.equal(res.body.error.code, 'RATE_LIMITED');
      assert.ok(res.headers.get('ratelimit-policy') || res.headers.get('ratelimit'));
    } finally {
      await strict.close();
    }
  });

  test('BR-AUTH-007 limites padrão da spec', async () => {
    const { DEFAULT_LIMITS } = await import('../src/middleware/rate-limit.js');
    const { login, register, csrf } = DEFAULT_LIMITS; // os outros limites (fotos, CEP) têm teste próprio
    assert.deepEqual({ login, register, csrf }, {
      login: { perMinute: 10, perHour: 50 },
      register: { perMinute: 5, perHour: 20 },
      csrf: { perMinute: 30, perHour: 300 },
    });
  });

  test('GET /auth/csrf também tem limite (não deixa lotar a tabela de sessões)', async () => {
    const strict = await startApp({ db: prisma, limits: { ...LOOSE, csrf: { perMinute: 2, perHour: 10 } } });
    try {
      const codes = [];
      for (let i = 0; i < 3; i++) codes.push((await createClient(strict.base).get('/auth/csrf')).status);
      assert.deepEqual(codes, [200, 200, 429]);
    } finally {
      await strict.close();
    }
  });
});
