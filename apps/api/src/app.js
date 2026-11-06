/**
 * app.js — Fábrica da aplicação Express.
 *
 * Recebe as dependências por parâmetro (injeção simples) para que os
 * testes possam usar um banco falso, um logger capturável e limites menores.
 */
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { BROWSER_IMAGE_HOSTS } from '@petspost/domain';
import cookieParser from 'cookie-parser';
import { healthRouter } from './routes/health.js';
import { siteRouter } from './routes/site.js';
import { notFound, errorHandler } from './middleware/errors.js';
import { sessionMiddleware, csrf as createCsrf } from './middleware/session.js';
import { loadUser } from './middleware/auth.js';
import { DEFAULT_LIMITS } from './middleware/rate-limit.js';
import { PrismaSessionStore } from './lib/session-store.js';
import { createLogger, createSecurityLog } from './lib/security-log.js';
import { createDiskStorage } from './lib/storage.js';
import { createGeocoder } from './lib/geocoder.js';
import { createCepClient } from './lib/cep.js';
import { createUserRepository } from './modules/users/repository.js';
import { createAuthService } from './modules/auth/service.js';
import { authRouter } from './modules/auth/router.js';
import { createPostRepository } from './modules/posts/repository.js';
import { createPostService } from './modules/posts/service.js';
import { postsRouter, meRouter } from './modules/posts/router.js';
import { createPhotoRepository } from './modules/photos/repository.js';
import { createPhotoService } from './modules/photos/service.js';
import { createGeoJobs } from './modules/geo/jobs.js';
import { cepRouter } from './modules/geo/router.js';
import { createAdoptionRepository } from './modules/adoption/repository.js';
import { createAdoptionService } from './modules/adoption/service.js';
import { adoptionRouter, meAdoptionRouter } from './modules/adoption/router.js';
import { createPartnerRepository } from './modules/partners/repository.js';
import { createPartnerService } from './modules/partners/service.js';
import { partnersRouter } from './modules/partners/router.js';
import { createAdminRepository } from './modules/admin/repository.js';
import { createAdminService } from './modules/admin/service.js';
import { adminRouter } from './modules/admin/router.js';
import { createProductRepository } from './modules/store/repository.js';
import { createStoreService, createAdminProductService } from './modules/store/service.js';
import { storeRouter, adminProductsRouter } from './modules/store/router.js';
import { createProductImporter } from './modules/store/importer.js';
import { createSafeFetcher } from './lib/safe-fetch.js';
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
 *   geocoder?: ReturnType<typeof createGeocoder> | null, // null = sem geocodificação
 *   cep?: ReturnType<typeof createCepClient>,
 *   importer?: ReturnType<typeof createProductImporter>, // importar produto de um link (testes passam um falso)
 * }} deps
 */
export function createApp({ config, db, logger, securityLog, sessionStore, limits, webDistDir, storage, geocoder, cep, importer }) {
  const app = express();
  limits = { ...DEFAULT_LIMITS, ...limits }; // quem passa só alguns limites herda o resto
  logger ??= createLogger(config);
  securityLog ??= createSecurityLog(logger);
  storage ??= createDiskStorage({ dir: config.UPLOAD_DIR ?? fileURLToPath(new URL('../uploads', import.meta.url)) });
  if (geocoder === undefined) {
    geocoder = config.GEOCODER_ENABLED ? createGeocoder({ userAgent: config.GEOCODER_USER_AGENT, logger }) : null;
  }
  cep ??= createCepClient();
  importer ??= createProductImporter({ fetcher: createSafeFetcher() });

  app.disable('x-powered-by');

  // Atrás do Nginx em produção: enxergar IP real (rate limit, logs).
  if (config.NODE_ENV === 'production') app.set('trust proxy', 1);

  // CSP final (T7.8): nada inline, nada de fora, a não ser os "tiles" do mapa (OpenStreetMap) e a
  // prévia das fotos antes do envio (blob:). O build do Vite não tem script nem estilo inline.
  const cspDirectives = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https://tile.openstreetmap.org'],
    'connect-src': ["'self'"],
    'font-src': ["'self'", 'data:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  app.use(helmet({
    contentSecurityPolicy: { directives: cspDirectives },
    // A política de uso dos tiles do OpenStreetMap exige o Referer; manda só a origem, não a URL inteira.
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  // BR-STORE-015: só nas páginas do painel, o navegador do admin pode baixar fotos dos servidores da lista
  // (quando a loja limita o nosso servidor). O resto do site continua sem acesso a nada de fora.
  app.use('/admin', helmet.contentSecurityPolicy({
    directives: { ...cspDirectives, 'connect-src': ["'self'", ...BROWSER_IMAGE_HOSTS.map((h) => `https://${h}`)] },
  }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/v1/health', healthRouter({ db }));
  app.use('/api/v1/site', siteRouter({ config })); // antes da sessão: não cria sessão para visitante

  // --- Sessão, CSRF e usuário logado (specs/api/auth.md) ---
  const users = createUserRepository(db);
  const csrf = createCsrf({ config });
  app.use('/api', cookieParser());
  sessionStore ??= new PrismaSessionStore(db);
  app.use('/api', sessionMiddleware({ config, store: sessionStore }));
  app.use('/api', csrf.protect); // BR-AUTH-012: POST/PUT/PATCH/DELETE exigem X-CSRF-Token
  app.use('/api', loadUser({ users }));

  app.use('/api/v1/auth', authRouter({ auth: createAuthService({ users, securityLog }), csrf, limits, securityLog }));

  const photoService = createPhotoService({ photos: createPhotoRepository(db), storage, logger });
  const postRepository = createPostRepository(db);
  const geo = createGeoJobs({ geocoder, logger });
  app.locals.geo = geo; // os testes esperam a fila com app.locals.geo.idle()
  const postService = createPostService({ posts: postRepository, photos: photoService, geo });
  app.use('/api/v1/posts', postsRouter({ service: postService, limits }));
  app.use('/api/v1/me', meRouter({ service: postService }));

  // Adoção: mesmas peças de fotos/geocodificação, com a tabela adoption_photos (Q-002).
  const adoptionPhotos = createPhotoService({
    photos: createPhotoRepository(db, { model: 'adoptionPhoto', ownerKey: 'adoptionPostId' }),
    storage,
    logger,
  });
  const adoptionService = createAdoptionService({ adoptions: createAdoptionRepository(db), photos: adoptionPhotos, geo });
  app.use('/api/v1/adoption', adoptionRouter({ service: adoptionService, limits }));
  app.use('/api/v1/me', meAdoptionRouter({ service: adoptionService }));

  app.use('/api/v1/partners', partnersRouter({ service: createPartnerService({ partners: createPartnerRepository(db) }) }));

  // Painel admin (PERM-003). Desativar usuário encerra as sessões dele (BR-ADMIN-005).
  const adminService = createAdminService({ admin: createAdminRepository(db), geocoder, sessions: sessionStore, securityLog });
  // Loja (Etapa 7b): vitrine pública + cadastro no admin, com as mesmas peças de fotos.
  const productRepository = createProductRepository(db);
  const storeService = createStoreService({ products: productRepository });
  const productPhotos = createPhotoService({
    photos: createPhotoRepository(db, { model: 'productPhoto', ownerKey: 'productId' }),
    storage,
    logger,
  });
  app.use('/api/v1/store', storeRouter({ service: storeService }));
  app.use('/api/v1/admin/products', adminProductsRouter({ service: createAdminProductService({ products: productRepository, photos: productPhotos, importer }), limits }));
  app.use('/api/v1/admin', adminRouter({ service: adminService }));
  app.use('/api/v1/cep', cepRouter({ cep, limits }));

  app.use('/api', notFound);

  // Fotos (ADR 006). `/static/uploads` é o caminho do Flask, ainda gravado nas fotos antigas.
  // Nome é UUID e nunca é reaproveitado, então o cache pode ser longo.
  app.use(['/uploads', '/static/uploads'],
    express.static(storage.dir, { index: false, dotfiles: 'deny', immutable: true, maxAge: '1y', redirect: false }),
    notFound);

  // Front (build do Vite) + Open Graph — ADR 002
  if (webDistDir) {
    app.use(webRouter({
      distDir: webDistDir,
      og: { post: postService, adoption: adoptionService, product: storeService },
      publicUrl: config.PUBLIC_URL,
      cache: config.NODE_ENV === 'production',
      onError: (err) => logger.error({ err }, 'erro ao montar página'),
    }));
  }
  app.use(errorHandler({ config, logger }));

  return app;
}
