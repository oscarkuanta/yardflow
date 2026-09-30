import { Router } from 'express';
import { createRequireAuth } from './middleware/authenticate.js';
import { createLoginRateLimiter } from './middleware/rate-limit.js';
import { createAuditService } from './modules/audit/audit.service.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createBlocksRouter } from './modules/blocks/blocks.routes.js';
import { createCompaniesRouter } from './modules/companies/companies.routes.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createTariffsRouter } from './modules/tariffs/tariffs.routes.js';
import { createTimeSlotsRouter } from './modules/timeslots/timeslots.routes.js';
import { createUsersRouter } from './modules/users/users.routes.js';

export function createApiRouter({ config, prisma, clock, loginAttemptsPerWindow }) {
  const dependencies = {
    config,
    prisma,
    clock,
    auditService: createAuditService({ prisma }),
    requireAuth: createRequireAuth({ prisma }),
  };
  const router = Router();
  router.use('/health', createHealthRouter(dependencies));
  router.use(
    '/auth',
    createAuthRouter({
      ...dependencies,
      loginRateLimiter: createLoginRateLimiter({ limit: loginAttemptsPerWindow }),
    }),
  );
  router.use('/users', createUsersRouter(dependencies));
  router.use('/companies', createCompaniesRouter(dependencies));
  router.use('/blocks', createBlocksRouter(dependencies));
  router.use('/tariffs', createTariffsRouter(dependencies));
  router.use('/time-slots', createTimeSlotsRouter(dependencies));
  return router;
}
