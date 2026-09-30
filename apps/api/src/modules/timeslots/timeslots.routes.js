import { Router } from 'express';
import { requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createTimeSlotsController } from './timeslots.controller.js';
import { listTimeSlotsQuery, updateCapacityBody } from './timeslots.schemas.js';
import { createTimeSlotsService } from './timeslots.service.js';

export function createTimeSlotsRouter({ prisma, auditService, requireAuth, clock, config }) {
  const controller = createTimeSlotsController({
    timeSlotsService: createTimeSlotsService({
      prisma,
      auditService,
      clock,
      defaultSlotCapacity: config.defaultSlotCapacity,
    }),
  });
  const router = Router();
  router.use(requireAuth);
  router.get(
    '/',
    requireRole('ADMIN', 'CUSTOMER'),
    validate({ query: listTimeSlotsQuery }),
    controller.list,
  );
  router.patch(
    '/',
    requireRole('ADMIN'),
    validate({ body: updateCapacityBody }),
    controller.updateCapacity,
  );
  return router;
}
