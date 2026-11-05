/**
 * app.js — Fábrica da aplicação Express (equivalente ao create_app do Flask).
 *
 * Recebe as dependências por parâmetro (injeção simples) para que os
 * testes possam usar um banco falso sem precisar de MySQL.
 */
import express from 'express';
import helmet from 'helmet';
import { healthRouter } from './routes/health.js';
import { notFound, errorHandler } from './middleware/errors.js';

/**
 * @param {{ config: ReturnType<typeof import('./config.js').loadConfig>, db: { $queryRaw: Function } }} deps
 */
export function createApp({ config, db }) {
  const app = express();

  app.disable('x-powered-by');

  // Atrás do Nginx em produção: enxergar IP real (rate limit, logs) — igual ao ProxyFix
  if (config.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/v1/health', healthRouter({ db }));

  app.use('/api', notFound);
  app.use(errorHandler({ config }));

  return app;
}
