/**
 * app.js — Fábrica da aplicação Express.
 *
 * Recebe as dependências por parâmetro (injeção simples) para que os
 * testes possam usar um banco falso, um logger capturável e limites menores.
 */
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { healthRouter } from './routes/health.js';
import { notFound, errorHandler } from './middleware/errors.js';
import { sessionMiddleware, csrf as createCsrf } from './middleware/session.js';
import { loadUser } from './middleware/auth.js';
import { DEFAULT_LIMITS } from './middleware/rate-limit.js';
import { PrismaSessionStore } from './lib/session-store.js';
import { createLogger, createSecurityLog } from './lib/security-log.js';
import { createUserRepository } from './modules/users/repository.js';
import { createAuthService } from './modules/auth/service.js';
import { authRouter } from './modules/auth/router.js';
import { createPostRepository } from './modules/posts/repository.js';
import { createPostService } from './modules/posts/service.js';
import { postsRouter, meRouter } from './modules/posts/router.js';

/**
 * @param {{
 *   config: ReturnType<typeof import('./config.js').loadConfig>,
 *   db: import('@prisma/client').PrismaClient,
 *   logger?: import('pino').Logger,
 *   securityLog?: (event: string, fields: object) => void,
 *   sessionStore?: import('express-session').Store,
 *   limits?: typeof DEFAULT_LIMITS,
 * }} deps
 */
export function createApp({ config, db, logger, securityLog, sessionStore, limits = DEFAULT_LIMITS }) {
  const app = express();
  logger ??= createLogger(config);
  securityLog ??= createSecurityLog(logger);

  app.disable('x-powered-by');

  // Atrás do Nginx em produção: enxergar IP real (rate limit, logs).
  if (config.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/v1/health', healthRouter({ db }));

  // --- Sessão, CSRF e usuário logado (specs/api/auth.md) ---
  const users = createUserRepository(db);
  const csrf = createCsrf({ config });
  app.use('/api', cookieParser());
  app.use('/api', sessionMiddleware({ config, store: sessionStore ?? new PrismaSessionStore(db) }));
  app.use('/api', csrf.protect); // BR-AUTH-012: POST/PUT/PATCH/DELETE exigem X-CSRF-Token
  app.use('/api', loadUser({ users }));

  app.use('/api/v1/auth', authRouter({ auth: createAuthService({ users, securityLog }), csrf, limits, securityLog }));

  const postService = createPostService({ posts: createPostRepository(db) });
  app.use('/api/v1/posts', postsRouter({ service: postService }));
  app.use('/api/v1/me', meRouter({ service: postService }));

  app.use('/api', notFound);
  app.use(errorHandler({ config, logger }));

  return app;
}
