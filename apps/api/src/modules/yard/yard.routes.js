import { STAFF_ROLES } from '@yardflow/shared';
import { Router } from 'express';
import { requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createYardController } from './yard.controller.js';
import { moveBody, stackParams, suggestionsBody } from './yard.schemas.js';
import { createYardService } from './yard.service.js';

export function createYardRouter({ prisma, auditService, eventBus, clock, requireAuth }) {
  const controller = createYardController({
    yardService: createYardService({ prisma, auditService, eventBus, clock }),
  });
  const staffOnly = requireRole(...STAFF_ROLES);
  const router = Router();
  router.use(requireAuth);
  router.get('/map', staffOnly, controller.map);
  router.get(
    '/stacks/:block/:row/:bay',
    staffOnly,
    validate({ params: stackParams }),
    controller.stack,
  );
  router.post(
    '/suggestions',
    staffOnly,
    validate({ body: suggestionsBody }),
    controller.suggestions,
  );
  router.post(
    '/moves',
    requireRole('ADMIN', 'PLANNER'),
    validate({ body: moveBody }),
    controller.move,
  );
  return router;
}
