/**
 * server.js — Ponto de entrada (equivalente ao run.py do Flask).
 */
import { fileURLToPath } from 'node:url';
import { prisma } from '@petspost/db';
import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { createLogger } from './lib/security-log.js';
import { PrismaSessionStore } from './lib/session-store.js';

const config = loadConfig();
const logger = createLogger(config);
if (config.SESSION_SECRET_GENERATED) {
  logger.warn('SESSION_SECRET ausente: usando uma chave temporária (sessões somem ao reiniciar).');
}
// Limpa sessões expiradas a cada 15 min.
const sessionStore = new PrismaSessionStore(prisma, { pruneIntervalMs: 15 * 60 * 1000 });
// Em produção o Express também serve o front (apps/web/dist).
const webDistDir =
  config.WEB_DIST_DIR ?? (config.NODE_ENV === 'production' ? fileURLToPath(new URL('../../web/dist', import.meta.url)) : undefined);
const app = createApp({ config, db: prisma, logger, sessionStore, webDistDir });

const server = app.listen(config.API_PORT, () => {
  logger.info(`Pets Post API em http://localhost:${config.API_PORT} (${config.NODE_ENV})`);
});

async function shutdown(signal) {
  console.log(`[api] ${signal} recebido, encerrando...`);
  server.close();
  sessionStore.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
