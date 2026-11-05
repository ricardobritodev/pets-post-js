// BR-AUTH-004 — compatibilidade com hashes do Werkzeug (Flask)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { hashPassword, verifyPassword, needsRehash, CURRENT_METHOD } from '../src/password.js';

// Vetores gerados com o Werkzeug 3.1.3 REAL (generate_password_hash).
const WERKZEUG_VECTORS = [
  ['Admin@123', 'pbkdf2:sha256:600000$CnixojrrZdqzkvsS$46f50fa98233d044161bc9493fe623122f6ea6e5f82362805e03d62d516cef94'],
  ['Admin@123', 'pbkdf2:sha256:1000000$3Rc1Cepb1U8s41zt$5b1e9127c9d2dc86b39d766a3f657d635dce90528b65e3dec8711e97db776cc1'],
  ['Admin@123', 'pbkdf2:sha512:1000$fRrqzrNlcbDYLMcf$1aa34f58e7c90b09cde0eceb639ef5452691b025f80868de6c207fe9c581a3516057dd8dfff1da828a2a235bcb38f08cc87ef4c51912ef562e4cc8d97b9225c6'],
  ['senha-ção-ü 123', 'pbkdf2:sha256:1000$RxxfGV0oPD5VDNSI$8215eded3df6e0db706e7ac14fbc24d87f17ce8e2129bb20a9f68e16c975ec7d'],
];

for (const [password, hash] of WERKZEUG_VECTORS) {
  test(`BR-AUTH-004 aceita hash Werkzeug ${hash.split('$')[0]}`, async () => {
    assert.equal(await verifyPassword(hash, password), true);
    assert.equal(await verifyPassword(hash, password + 'x'), false);
    assert.equal(needsRehash(hash), true);
  });
}

test('scrypt do Node bate com o vetor oficial da RFC 7914 (mesma primitiva do Werkzeug)', async () => {
  const key = await promisify(scrypt)('pleaseletmein', 'SodiumChloride', 64, {
    N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024,
  });
  assert.equal(
    key.toString('hex'),
    '7023bdcb3afd7348461c06cd81fd38ebfda8fbba904f8e3ea9b543f6545da1f2' +
      'd5432955613f0fcf62d49705242a9af9e61e85dc0d651e40dfcf017b45575887',
  );
});

test('BR-AUTH-004 hash novo usa formato Werkzeug scrypt e verifica', async () => {
  const hash = await hashPassword('Admin@123');
  assert.match(hash, /^scrypt:32768:8:1\$[A-Za-z0-9]{16}\$[0-9a-f]{128}$/);
  assert.ok(hash.startsWith(`${CURRENT_METHOD}$`));
  assert.equal(await verifyPassword(hash, 'Admin@123'), true);
  assert.equal(await verifyPassword(hash, 'admin@123'), false);
  assert.equal(needsRehash(hash), false);
});

test('BR-AUTH-004 salts diferentes geram hashes diferentes', async () => {
  assert.notEqual(await hashPassword('mesma'), await hashPassword('mesma'));
});

test('BR-AUTH-004 hash malformado ou ausente retorna false sem lançar', async () => {
  for (const bad of [null, undefined, '', 'abc', 'md5$x$y', 'scrypt:a:b:c$salt$00', 'pbkdf2:sha999:10$s$00']) {
    assert.equal(await verifyPassword(bad, 'qualquer'), false);
  }
});

test('hashPassword rejeita senha vazia', async () => {
  await assert.rejects(() => hashPassword(''), TypeError);
});
