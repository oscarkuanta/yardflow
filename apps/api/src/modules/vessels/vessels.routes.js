import express, { Router } from 'express';
import { validationFailed } from '../../lib/errors.js';
import { requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createVesselCargoService } from './vessel-cargo.service.js';
import { createVesselItemsService } from './vessel-items.service.js';
import { createVesselsController } from './vessels.controller.js';
import {
  createVisitBody,
  dischargeBody,
  itemParams,
  listVisitsQuery,
  updateVisitBody,
  visitItemSchema,
  visitParams,
} from './vessels.schemas.js';
import { createVesselsService } from './vessels.service.js';

export const CSV_BODY_LIMIT = '1mb';

function requireCsvBody(request, _response, next) {
  if (typeof request.body !== 'string' || request.body.trim() === '') {
    next(
      validationFailed([
        { field: 'body', message: 'Send the list as a CSV text body with Content-Type text/csv' },
      ]),
    );
    return;
  }
  next();
}

export function createVesselsRouter({ prisma, auditService, eventBus, clock, requireAuth }) {
  const dependencies = { prisma, auditService, eventBus, clock };
  const controller = createVesselsController({
    vesselsService: createVesselsService(dependencies),
    itemsService: createVesselItemsService(dependencies),
    cargoService: createVesselCargoService(dependencies),
  });
  const router = Router();
  router.use(requireAuth, requireRole('ADMIN', 'PLANNER'));
  router.get('/', validate({ query: listVisitsQuery }), controller.list);
  router.post('/', validate({ body: createVisitBody }), controller.create);
  router.get('/:id', validate({ params: visitParams }), controller.detail);
  router.patch('/:id', validate({ params: visitParams, body: updateVisitBody }), controller.update);
  router.post(
    '/:id/items',
    validate({ params: visitParams, body: visitItemSchema }),
    controller.addItem,
  );
  router.post(
    '/:id/items/import',
    express.text({ type: 'text/csv', limit: CSV_BODY_LIMIT }),
    validate({ params: visitParams }),
    requireCsvBody,
    controller.importItems,
  );
  router.post(
    '/:id/items/:itemId/discharge',
    validate({ params: itemParams, body: dischargeBody }),
    controller.discharge,
  );
  router.post('/:id/items/:itemId/load', validate({ params: itemParams }), controller.load);
  return router;
}
