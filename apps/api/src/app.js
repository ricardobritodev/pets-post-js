/**
 * app.js — Fábrica da aplicação Express.
 *
 * Recebe as dependências por parâmetro (injeção simples) para que os
 * testes possam usar um banco falso, um logger capturável e limites menores.
 */
import { fileURLToPath } from 'node:url';
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
import { createDiskStorage } from './lib/storage.js';
import { createUserRepository } from './modules/users/repository.js';
import { createAuthService } from './modules/auth/service.js';
import { authRouter } from './modules/auth/router.js';
import { createPostRepository } from './modules/posts/repository.js';
import { createPostService } from './modules/posts/service.js';
import { postsRouter, meRouter } from './modules/posts/router.js';
import { createPhotoRepository } from './modules/photos/repository.js';
import { createPhotoService } from './modules/photos/service.js';
import { webRouter } from './web/router.js';

/**
 * @param {{
 *   config: ReturnType<typeof import('./config.js').loadConfig>,
 *   db: import('@prisma/client').PrismaClient,
 *   logger?: import('pino').Logger,
 *   securityLog?: (event: string, fields: object) => void,
 *   sessionStore?: import('express-session').Store,
 *   limits?: typeof DEFAULT_LIMITS,
 *   webDistDir?: string, // serve o build do front (produção)
 *   storage?: ReturnType<typeof createDiskStorage>, // onde as fotos ficam (ADR 006)
 * }} deps
 */
export function createApp({ config, db, logger, securityLog, sessionStore, limits, webDistDir, storage }) {
  const app = express();
  limits = { ...DEFAULT_LIMITS, ...limits }; // quem passa só alguns limites herda o resto
  logger ??= createLogger(config);
  securityLog ??= createSecurityLog(logger);
  storage ??= createDiskStorage({ dir: config.UPLOAD_DIR ?? fileURLToPath(new URL('../uploads', import.meta.url)) });

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

  const photoService = createPhotoService({ photos: createPhotoRepository(db), storage, logger });
  const postService = createPostService({ posts: createPostRepository(db), photos: photoService });
  app.use('/api/v1/posts', postsRouter({ service: postService, limits }));
  app.use('/api/v1/me', meRouter({ service: postService }));

  app.use('/api', notFound);

  // Fotos (ADR 006). `/static/uploads` é o caminho do Flask, ainda gravado nas fotos antigas.
  // Nome é UUID e nunca é reaproveitado, então o cache pode ser longo.
  app.use(['/uploads', '/static/uploads'],
    express.static(storage.dir, { index: false, dotfiles: 'deny', immutable: true, maxAge: '1y', redirect: false }),
    notFound);

  // Front (build do Vite) + Open Graph — ADR 002
  if (webDistDir) {
    app.use(webRouter({ distDir: webDistDir, posts: postService, publicUrl: config.PUBLIC_URL, cache: config.NODE_ENV === 'production' }));
  }
  app.use(errorHandler({ config, logger }));

  return app;
}
