import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { createRequestLogger } from './lib/request-logger.js';
import { createRequireAuth } from './middleware/authenticate.js';
import { errorHandler, routeNotFound } from './middleware/error-handler.js';
import { createLoginRateLimiter } from './middleware/rate-limit.js';
import { createSessionMiddleware } from './middleware/session.js';
import { createAuditService } from './modules/audit/audit.service.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createDocsRouter, loadOpenApiDocument } from './openapi/docs.js';

export const API_BASE_PATH = '/api/v1';
export const DOCS_PATH = '/api/docs';
const JSON_BODY_LIMIT = '100kb';

function createApiRouter({ prisma, loginAttemptsPerWindow }) {
  const auditService = createAuditService({ prisma });
  const requireAuth = createRequireAuth({ prisma });
  const router = Router();
  router.use('/health', createHealthRouter({ prisma }));
  router.use(
    '/auth',
    createAuthRouter({
      prisma,
      auditService,
      requireAuth,
      loginRateLimiter: createLoginRateLimiter({ limit: loginAttemptsPerWindow }),
    }),
  );
  return router;
}

export function createApp({ config, prisma, sessionStore, logger, loginAttemptsPerWindow }) {
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
  app.use(API_BASE_PATH, sessionMiddleware, createApiRouter({ prisma, loginAttemptsPerWindow }));
  app.use(DOCS_PATH, createDocsRouter(loadOpenApiDocument()));
  app.use(routeNotFound);
  app.use(errorHandler);
  return app;
}
