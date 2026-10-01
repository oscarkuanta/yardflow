import { Router } from 'express';
import { createRequireAuth } from './middleware/authenticate.js';
import { createLoginRateLimiter } from './middleware/rate-limit.js';
import { createAuditLogsRouter } from './modules/audit/audit-logs.routes.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createInvoicesRouter } from './modules/billing/invoices.routes.js';
import { createBlocksRouter } from './modules/blocks/blocks.routes.js';
import { createCompaniesRouter } from './modules/companies/companies.routes.js';
import { createContainersRouter } from './modules/containers/containers.routes.js';
import { createCustomsRouter } from './modules/customs/customs.routes.js';
import { createExportsRouter } from './modules/exports/exports.routes.js';
import { createGateRouter } from './modules/gate/gate.routes.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createNotificationsRouter } from './modules/notifications/notifications.routes.js';
import { createPreAdvicesRouter } from './modules/preadvices/preadvices.routes.js';
import { createPublicRouter } from './modules/public/public.routes.js';
import { createReportsRouter } from './modules/reports/reports.routes.js';
import { createTariffsRouter } from './modules/tariffs/tariffs.routes.js';
import { createTimeSlotsRouter } from './modules/timeslots/timeslots.routes.js';
import { createUsersRouter } from './modules/users/users.routes.js';
import { createVesselsRouter } from './modules/vessels/vessels.routes.js';
import { createWorkOrdersRouter } from './modules/workorders/workorders.routes.js';
import { createYardRouter } from './modules/yard/yard.routes.js';

export const API_MOUNTS = [
  ['/health', createHealthRouter],
  ['/public', createPublicRouter],
  ['/auth', createAuthRouter],
  ['/users', createUsersRouter],
  ['/companies', createCompaniesRouter],
  ['/blocks', createBlocksRouter],
  ['/tariffs', createTariffsRouter],
  ['/time-slots', createTimeSlotsRouter],
  ['/containers', createContainersRouter],
  ['/yard', createYardRouter],
  ['/work-orders', createWorkOrdersRouter],
  ['/vessel-visits', createVesselsRouter],
  ['/pre-advices', createPreAdvicesRouter],
  ['/gate', createGateRouter],
  ['/customs-holds', createCustomsRouter],
  ['/invoices', createInvoicesRouter],
  ['/notifications', createNotificationsRouter],
  ['/reports', createReportsRouter],
  ['/exports', createExportsRouter],
  ['', createAuditLogsRouter],
];

export function buildApiRouters({ loginAttemptsPerWindow, ...services }) {
  const dependencies = {
    ...services,
    requireAuth: createRequireAuth(services),
    loginRateLimiter: createLoginRateLimiter({ limit: loginAttemptsPerWindow }),
  };
  return API_MOUNTS.map(([mountPath, createRouter]) => [mountPath, createRouter(dependencies)]);
}

export function createApiRouter(services) {
  const router = Router();
  for (const [mountPath, moduleRouter] of buildApiRouters(services)) {
    router.use(mountPath || '/', moduleRouter);
  }
  return router;
}
