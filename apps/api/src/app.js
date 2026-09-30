import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createEventBus } from './lib/event-bus.js';
import { createRequestLogger } from './lib/request-logger.js';
import { errorHandler, routeNotFound } from './middleware/error-handler.js';
import { createSessionMiddleware } from './middleware/session.js';
import { createDocsRouter, loadOpenApiDocument } from './openapi/docs.js';
import { createApiRouter } from './routes.js';

export const API_BASE_PATH = '/api/v1';
export const DOCS_PATH = '/api/docs';
const JSON_BODY_LIMIT = '100kb';

function systemClock() {
  return new Date();
}

export function createApp({
  config,
  prisma,
  sessionStore,
  logger,
  loginAttemptsPerWindow,
  clock = systemClock,
  eventBus = createEventBus(),
}) {
  const app = express();
  const sessionMiddleware = createSessionMiddleware({
    sessionSecret: config.sessionSecret,
    isProduction: config.isProduction,
    store: sessionStore,
  });
  if (config.isProduction) {
    app.set('trust proxy', 1);
  }
  app.locals.sessionMiddleware = sessionMiddleware;
  app.locals.eventBus = eventBus;
  app.use(createRequestLogger({ logger, ignoredPathPrefix: DOCS_PATH }));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { upgradeInsecureRequests: config.isProduction ? [] : null },
      },
    }),
  );
  app.use(cors({ origin: config.webOrigin, credentials: true }));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(
    API_BASE_PATH,
    sessionMiddleware,
    createApiRouter({ config, prisma, clock, eventBus, loginAttemptsPerWindow }),
  );
  app.use(DOCS_PATH, createDocsRouter(loadOpenApiDocument()));
  app.use(routeNotFound);
  app.use(errorHandler);
  return app;
}
