import { Router } from 'express';
import { requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createExportsController } from './exports.controller.js';
import {
  containersExportQuery,
  invoicesExportQuery,
  movementsExportQuery,
} from './exports.schemas.js';
import { createExportsService } from './exports.service.js';

export function createExportsRouter({ prisma, clock, requireAuth }) {
  const controller = createExportsController({
    exportsService: createExportsService({ prisma, clock }),
  });
  const planning = requireRole('ADMIN', 'PLANNER');
  const router = Router();
  router.use(requireAuth);
  router.get(
    '/containers.csv',
    planning,
    validate({ query: containersExportQuery }),
    controller.containers,
  );
  router.get(
    '/movements.csv',
    planning,
    validate({ query: movementsExportQuery }),
    controller.movements,
  );
  router.get(
    '/invoices.csv',
    requireRole('ADMIN'),
    validate({ query: invoicesExportQuery }),
    controller.invoices,
  );
  return router;
}
