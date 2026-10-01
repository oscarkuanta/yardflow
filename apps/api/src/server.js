import { createApp, DOCS_PATH } from './app.js';
import { loadConfig } from './config/env.js';
import { clockFromStart } from './lib/clock.js';
import { createLogger } from './lib/logger.js';
import { createPrismaClient } from './lib/prisma.js';
import { createSessionStore } from './middleware/session.js';
import { EXPIRY_INTERVAL_MS } from './modules/preadvices/preadvice-expiry.js';
import { attachRealtime } from './realtime/socket.js';

const config = loadConfig();
const logger = createLogger(config);
const prisma = createPrismaClient(config);
const sessionStore = createSessionStore(config);
const clock = clockFromStart(config.clockStart);
const app = createApp({ config, prisma, sessionStore, logger, clock });
if (config.clockStart) {
  logger.warn(`Demo clock started at ${config.clockStart}`);
}

async function expireOverduePreAdvices() {
  try {
    const expiredCount = await app.locals.preAdviceExpiry.expireOverdue();
    if (expiredCount > 0) {
      logger.info(`${expiredCount} pre-advices expired`);
    }
  } catch (error) {
    logger.error({ err: error }, 'Pre-advice expiry failed');
  }
}

const expiryTimer = setInterval(expireOverduePreAdvices, EXPIRY_INTERVAL_MS);

const server = app.listen(config.port, () => {
  logger.info(`YardFlow API listening on http://localhost:${config.port}`);
  logger.info(`API docs on http://localhost:${config.port}${DOCS_PATH}`);
});
const realtime = attachRealtime({ httpServer: server, app, prisma, config });

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  clearInterval(expiryTimer);
  await realtime.close();
  server.close();
  await sessionStore.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
