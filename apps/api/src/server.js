/**
 * server.js — Ponto de entrada (equivalente ao run.py do Flask).
 */
import { prisma } from '@petspost/db';
import { loadConfig } from './config.js';
import { createApp } from './app.js';

const config = loadConfig();
const app = createApp({ config, db: prisma });

const server = app.listen(config.API_PORT, () => {
  console.log(`[api] Pets Post API em http://localhost:${config.API_PORT} (${config.NODE_ENV})`);
});

async function shutdown(signal) {
  console.log(`[api] ${signal} recebido, encerrando...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
