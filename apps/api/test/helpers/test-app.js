import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { createLogger } from '../../src/lib/logger.js';
import { createPrismaClient } from '../../src/lib/prisma.js';
import { createSessionStore } from '../../src/middleware/session.js';

export const TEST_WEB_ORIGIN = 'http://localhost:5173';
const GENEROUS_LOGIN_LIMIT = 1000;

export function createTestConfig(overrides = {}) {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: process.env.DATABASE_URL_TEST,
    SESSION_SECRET: 'test-session-secret-long-enough',
    WEB_ORIGIN: TEST_WEB_ORIGIN,
    ...overrides,
  });
}

export function createTestContext({
  configOverrides = {},
  loginAttemptsPerWindow = GENEROUS_LOGIN_LIMIT,
  prismaOverride,
} = {}) {
  const config = createTestConfig(configOverrides);
  const prisma = createPrismaClient(config);
  const sessionStore = createSessionStore(config);
  const app = createApp({
    config,
    prisma: prismaOverride ?? prisma,
    sessionStore,
    logger: createLogger(config),
    loginAttemptsPerWindow,
  });
  return {
    app,
    prisma,
    config,
    async close() {
      await sessionStore.close();
      await prisma.$disconnect();
    },
  };
}
