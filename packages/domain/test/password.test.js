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

// Vetores scrypt gerados com o Werkzeug 3.1.3 REAL (Python 3.13 + OpenSSL 3.5),
// via generate_password_hash(senha) — o método padrão do Werkzeug 3.x.
// Fecha a pendência P-02 / validação da ADR 003.
const WERKZEUG_SCRYPT_VECTORS = [
  ['Admin@123', 'scrypt:32768:8:1$rMdXabKhqOEQ5e9W$afad9949851e37e530ab62fdf98f0e848a0b1f0bcab7bb7422332074bf64c4964b14d333865ddcd4fe3bd856b746d74f39743b82170d0a8db61f7c61e0579194'],
  ['Senha@123', 'scrypt:32768:8:1$gWaaXK0tHLE9WqhP$774f8e70611e0ef9a01dbfcb6d3622055c5e7435e13175d9cea5a1439160aa2fec5bff995cea9450fc6f04f73d44ae8544e0d53a82d2700520d03663ad74048c'],
  ['senha-ção-ü 🐶 123', 'scrypt:32768:8:1$frz7oF9RAEXD0sTJ$def50394385015c9432998d987e58f761fcc52c5d074e9e7297cf78fc7918c6796af4ba06b4ed48f33385dfaf228c09af643f09988e46d161d48480e9c60595f'],
];

for (const [password, hash] of WERKZEUG_SCRYPT_VECTORS) {
  test(`BR-AUTH-004 aceita hash scrypt real do Werkzeug (${JSON.stringify(password)}) sem pedir re-hash`, async () => {
    assert.equal(await verifyPassword(hash, password), true);
    assert.equal(await verifyPassword(hash, password + 'x'), false);
    assert.equal(needsRehash(hash), false);
  });
}

test('BR-AUTH-004 scrypt do Werkzeug com parâmetros mais fracos verifica e pede re-hash', async () => {
  const hash = 'scrypt:16384:8:1$dQWQz6oRNdSPu9gg$801b347b8a25b549927821706f2f8484d52bf60bac2864071c3366e2f9b9206776a0db51bea232acd90f2a9106a508f47e57de15d034fd6105e8dee43735afd2';
  assert.equal(await verifyPassword(hash, 'Admin@123'), true);
  assert.equal(needsRehash(hash), true);
});

// Sentido inverso (rollback para o Flask): hash gerado por hashPassword() da v2,
// conferido com werkzeug.security.check_password_hash do Werkzeug 3.1.3 → True.
test('BR-AUTH-004 hash gerado pela v2 é o mesmo formato aceito pelo Werkzeug', async () => {
  const fromV2 = 'scrypt:32768:8:1$8WAlqyxkzmxsF3F6$c23968807fa97c9a527247be71fa436820c2009486aa6c1fe27f3626e7179be0a7263264ab4cbf1c9e80bb7ec3b3f7ee684f2392a68533dd0d6b15d35d257416';
  assert.equal(await verifyPassword(fromV2, 'Senha@123'), true);
  assert.equal((await hashPassword('Senha@123')).split('$')[0], fromV2.split('$')[0]);
});

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
