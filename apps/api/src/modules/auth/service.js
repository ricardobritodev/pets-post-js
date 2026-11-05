/**
 * Serviço de autenticação — regras BR-AUTH-001..006 e 011 (sem HTTP, sem sessão).
 * Spec: specs/api/auth.md
 */
import { hashPassword, verifyPassword, needsRehash } from '@petspost/domain';
import { HttpError } from '../../middleware/errors.js';

export const MESSAGES = Object.freeze({
  emailTaken: 'Este email já está cadastrado. Faça login ou use outro email.',
  invalidCredentials: 'Email ou senha incorretos. Tente novamente.',
  inactive: 'Esta conta foi desativada. Entre em contato com o suporte.',
});

/** O que a API devolve sobre o usuário (publicUserSchema) — nunca o hash. */
export const toPublicUser = ({ id, name, email, role, phone }) => ({ id, name, email, role, phone: phone ?? null });

/**
 * @param {{ users: ReturnType<typeof import('../users/repository.js').createUserRepository>,
 *           securityLog: (event: string, fields: object) => void }} deps
 */
export function createAuthService({ users, securityLog }) {
  // Hash "isca": com email inexistente o login gasta o mesmo tempo de um scrypt
  // de verdade, para não dar pista de quais emails estão cadastrados (BR-AUTH-006).
  let decoyHash;
  const getDecoyHash = async () => (decoyHash ??= await hashPassword(`decoy-${Math.random()}`));

  return {
    /** BR-AUTH-001..004 — cria a conta (não loga). */
    async register({ name, email, phone, password }, { ip }) {
      if (await users.existsByEmail(email)) throw new HttpError(409, 'CONFLICT', MESSAGES.emailTaken);
      let user;
      try {
        user = await users.create({ name, email, phone, passwordHash: await hashPassword(password) });
      } catch (err) {
        // Dois cadastros simultâneos com o mesmo email: o índice único decide.
        if (err?.code === 'P2002') throw new HttpError(409, 'CONFLICT', MESSAGES.emailTaken);
        throw err;
      }
      securityLog('register_success', { userId: user.id, email: user.email, ip });
      return toPublicUser(user);
    },

    /** BR-AUTH-004..006 — confere credenciais e devolve o usuário público. */
    async login({ email, password }, { ip }) {
      const user = await users.findByEmailWithHash(email);
      const ok = await verifyPassword(user?.passwordHash ?? (await getDecoyHash()), password);

      if (!user || !ok) {
        securityLog('login_failed', { email, ip });
        throw new HttpError(401, 'INVALID_CREDENTIALS', MESSAGES.invalidCredentials);
      }
      if (!user.isActive) {
        securityLog('login_blocked_inactive', { userId: user.id, ip });
        throw new HttpError(403, 'ACCOUNT_INACTIVE', MESSAGES.inactive);
      }
      // BR-AUTH-004 — hash legado (pbkdf2 / scrypt fraco) é regravado no formato atual.
      if (needsRehash(user.passwordHash)) {
        await users.updatePasswordHash(user.id, await hashPassword(password));
      }
      securityLog('login_success', { userId: user.id, ip });
      return toPublicUser(user);
    },
  };
}
