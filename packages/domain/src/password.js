/**
 * password.js — Hash de senha compatível com o Werkzeug (Flask).
 *
 * Spec: specs/adr/003-password-hash-migration.md · Regra BR-AUTH-004
 *
 * O banco herdado do Pets Post (Flask) guarda senhas no formato do
 * Werkzeug:   <método>$<salt>$<hash-hex>
 *   - scrypt:32768:8:1$<salt16>$<hex de 64 bytes>   (padrão do Werkzeug 3.x)
 *   - pbkdf2:sha256:600000$<salt16>$<hex>           (versões antigas)
 *
 * Decisão: a v2 CONTINUA gerando hashes nesse mesmo formato (scrypt),
 * usando só o módulo `crypto` nativo do Node. Vantagens:
 *   - nenhum usuário perde acesso na migração;
 *   - nenhuma dependência nativa (argon2/bcrypt) para compilar;
 *   - rollback para o Flask continua possível (os dois lados se entendem).
 * Hashes PBKDF2 legados são aceitos e sinalizados para re-hash (needsRehash).
 */
import { scrypt as scryptCb, pbkdf2 as pbkdf2Cb, randomInt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const pbkdf2 = promisify(pbkdf2Cb);

/** Parâmetros atuais — iguais ao padrão do Werkzeug 3.x. */
export const SCRYPT_PARAMS = Object.freeze({ N: 2 ** 15, r: 8, p: 1, keylen: 64 });
export const CURRENT_METHOD = `scrypt:${SCRYPT_PARAMS.N}:${SCRYPT_PARAMS.r}:${SCRYPT_PARAMS.p}`;

const SALT_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SALT_LENGTH = 16;
const DEFAULT_PBKDF2_ITERATIONS = 1_000_000; // valor do Werkzeug 3.1 quando omitido
const PBKDF2_DIGESTS = new Set(['sha1', 'sha224', 'sha256', 'sha384', 'sha512']);

/** Mesmo alfabeto e tamanho do `gen_salt(16)` do Werkzeug. */
export function generateSalt(length = SALT_LENGTH) {
  let salt = '';
  for (let i = 0; i < length; i++) salt += SALT_CHARS[randomInt(SALT_CHARS.length)];
  return salt;
}

/** Deriva o hash hex para um método no formato Werkzeug. */
async function deriveHex(method, salt, password) {
  const [name, ...args] = method.split(':');
  const pw = Buffer.from(password, 'utf8');
  const saltBuf = Buffer.from(salt, 'utf8');

  if (name === 'scrypt') {
    const [N, r, p] = args.length ? args.map(Number) : [SCRYPT_PARAMS.N, SCRYPT_PARAMS.r, SCRYPT_PARAMS.p];
    if (![N, r, p].every(Number.isInteger)) throw new Error(`Parâmetros scrypt inválidos: ${method}`);
    // Werkzeug usa maxmem = 132*N*r*p; o Node exige folga acima de 128*N*r*p.
    const maxmem = 132 * N * r * p + 1024 * 1024;
    const key = await scrypt(pw, saltBuf, SCRYPT_PARAMS.keylen, { N, r, p, maxmem });
    return key.toString('hex');
  }

  if (name === 'pbkdf2') {
    const digest = args[0] ?? 'sha256';
    const iterations = args[1] !== undefined ? Number(args[1]) : DEFAULT_PBKDF2_ITERATIONS;
    if (!PBKDF2_DIGESTS.has(digest) || !Number.isInteger(iterations) || iterations < 1) {
      throw new Error(`Parâmetros pbkdf2 inválidos: ${method}`);
    }
    // Werkzeug usa o tamanho padrão do digest (ex.: 32 bytes no sha256).
    const keylen = { sha1: 20, sha224: 28, sha256: 32, sha384: 48, sha512: 64 }[digest];
    const key = await pbkdf2(pw, saltBuf, iterations, keylen, digest);
    return key.toString('hex');
  }

  throw new Error(`Método de hash não suportado: ${name}`);
}

/**
 * Gera um hash novo no formato Werkzeug scrypt.
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new TypeError('A senha deve ser uma string não vazia.');
  }
  const salt = generateSalt();
  const hex = await deriveHex(CURRENT_METHOD, salt, password);
  return `${CURRENT_METHOD}$${salt}$${hex}`;
}

/**
 * Verifica uma senha contra um hash Werkzeug (scrypt ou pbkdf2).
 * Nunca lança para hash malformado — apenas retorna false.
 * @param {string|null|undefined} storedHash
 * @param {string} password
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(storedHash, password) {
  if (!storedHash || typeof password !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3) return false;
  const [method, salt, expectedHex] = parts;

  let actualHex;
  try {
    actualHex = await deriveHex(method, salt, password);
  } catch {
    return false;
  }

  const a = Buffer.from(actualHex, 'hex');
  const b = Buffer.from(expectedHex, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Indica se o hash deve ser regenerado após um login bem-sucedido
 * (ex.: PBKDF2 legado ou scrypt com parâmetros mais fracos).
 * @param {string|null|undefined} storedHash
 */
export function needsRehash(storedHash) {
  if (!storedHash) return true;
  return storedHash.split('$')[0] !== CURRENT_METHOD;
}
