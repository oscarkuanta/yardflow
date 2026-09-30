import { Router } from 'express';
import { idParams } from '../../lib/schemas.js';
import { requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createWorkOrdersController } from './workorders.controller.js';
import { listWorkOrdersQuery } from './workorders.schemas.js';
import { createWorkOrdersService } from './workorders.service.js';

export function createWorkOrdersRouter({ prisma, auditService, eventBus, clock, requireAuth }) {
  const controller = createWorkOrdersController({
    workOrdersService: createWorkOrdersService({ prisma, auditService, eventBus, clock }),
  });
  const router = Router();
  router.use(requireAuth, requireRole('ADMIN', 'PLANNER'));
  router.get('/', validate({ query: listWorkOrdersQuery }), controller.list);
  router.post('/:id/complete', validate({ params: idParams }), controller.complete);
  return router;
}
