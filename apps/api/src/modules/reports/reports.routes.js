import { Router } from 'express';
import { requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createReportsController } from './reports.controller.js';
import { gateMovesQuery } from './reports.schemas.js';
import { createReportsService } from './reports.service.js';

export function createReportsRouter({ prisma, clock, requireAuth }) {
  const controller = createReportsController({
    reportsService: createReportsService({ prisma, clock }),
  });
  const router = Router();
  router.use(requireAuth, requireRole('ADMIN', 'PLANNER'));
  router.get('/kpis', controller.kpis);
  router.get('/occupancy', controller.occupancy);
  router.get('/gate-moves', validate({ query: gateMovesQuery }), controller.gateMoves);
  router.get('/dwell', controller.dwell);
  return router;
}
