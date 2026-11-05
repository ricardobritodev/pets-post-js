/**
 * session-store.js — Store do express-session usando a tabela `sessions` via Prisma.
 * Spec: specs/api/auth.md (BR-AUTH-008) · migration 1_sessions (M-05)
 *
 * Por que não `express-mysql-session`: ele abre um pool MySQL próprio. Assim
 * fica tudo no mesmo client Prisma, e a tabela é versionada pelas migrations.
 */
import session from 'express-session';

const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

/** Data de expiração da sessão a partir do cookie (ou TTL padrão). */
export function expiresAtOf(sess, now = Date.now()) {
  const exp = sess?.cookie?.expires;
  if (exp) return new Date(exp);
  const maxAge = sess?.cookie?.maxAge ?? sess?.cookie?.originalMaxAge;
  return new Date(now + (Number.isFinite(maxAge) ? maxAge : DEFAULT_TTL_MS));
}

export class PrismaSessionStore extends session.Store {
  /**
   * @param {import('@prisma/client').PrismaClient} db
   * @param {{ pruneIntervalMs?: number }} [opts] limpeza periódica das expiradas (0 = desligada)
   */
  constructor(db, { pruneIntervalMs = 0 } = {}) {
    super();
    this.db = db;
    if (pruneIntervalMs > 0) {
      this.pruneTimer = setInterval(() => this.prune().catch(() => {}), pruneIntervalMs);
      this.pruneTimer.unref();
    }
  }

  /** Converte uma promise para o estilo callback que o express-session usa. */
  #cb(promise, cb) {
    promise.then((v) => cb?.(null, v), (err) => cb?.(err));
  }

  get(sid, cb) {
    this.#cb(
      (async () => {
        const row = await this.db.session.findUnique({ where: { sid } });
        if (!row) return null;
        if (row.expiresAt.getTime() <= Date.now()) {
          await this.db.session.deleteMany({ where: { sid } });
          return null;
        }
        return JSON.parse(row.data);
      })(),
      cb,
    );
  }

  set(sid, sess, cb) {
    const data = {
      data: JSON.stringify(sess),
      expiresAt: expiresAtOf(sess),
      userId: Number.isInteger(sess.userId) ? sess.userId : null,
    };
    this.#cb(this.db.session.upsert({ where: { sid }, create: { sid, ...data }, update: data }).then(() => undefined), cb);
  }

  /** Chamado a cada requisição com `rolling: true` — só renova a expiração. */
  touch(sid, sess, cb) {
    this.#cb(
      this.db.session.updateMany({ where: { sid }, data: { expiresAt: expiresAtOf(sess) } }).then(() => undefined),
      cb,
    );
  }

  destroy(sid, cb) {
    this.#cb(this.db.session.deleteMany({ where: { sid } }).then(() => undefined), cb);
  }

  /** Remove sessões expiradas. Devolve quantas apagou. */
  async prune() {
    const { count } = await this.db.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    return count;
  }

  /** Encerra todas as sessões de um usuário (ex.: conta desativada pelo admin). */
  async destroyAllForUser(userId) {
    const { count } = await this.db.session.deleteMany({ where: { userId } });
    return count;
  }

  close() {
    clearInterval(this.pruneTimer);
  }
}
