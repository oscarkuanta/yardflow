import { Router } from 'express';
import { idParams } from '../../lib/schemas.js';
import { requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createCustomsController } from './customs.controller.js';
import { listHoldsQuery, placeHoldBody } from './customs.schemas.js';
import { createCustomsService } from './customs.service.js';

export function createCustomsRouter({ prisma, auditService, eventBus, clock, requireAuth }) {
  const controller = createCustomsController({
    customsService: createCustomsService({ prisma, auditService, eventBus, clock }),
  });
  const router = Router();
  router.use(requireAuth, requireRole('ADMIN'));
  router.get('/', validate({ query: listHoldsQuery }), controller.list);
  router.post('/', validate({ body: placeHoldBody }), controller.place);
  router.post('/:id/release', validate({ params: idParams }), controller.release);
  return router;
}
