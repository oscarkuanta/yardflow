import { STAFF_ROLES } from '@yardflow/shared';
import { Router } from 'express';
import { idParams } from '../../lib/schemas.js';
import { requireRole } from '../../middleware/authenticate.js';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { createGateTransactionsService } from './gate-transactions.service.js';
import { createGateController } from './gate.controller.js';
import { gateInBody, gateOutBody, listTransactionsQuery, verifyTruckBody } from './gate.schemas.js';
import { createGateService } from './gate.service.js';

export const PIN_CHECK_WINDOW_MS = 15 * 60 * 1000;
export const PIN_CHECKS_PER_WINDOW = 60;

export function createGateRouter({
  prisma,
  auditService,
  eventBus,
  clock,
  config,
  requireAuth,
  preAdviceExpiry,
  pinLockout,
}) {
  const controller = createGateController({
    gateService: createGateService({
      prisma,
      auditService,
      eventBus,
      clock,
      config,
      pinLockout,
      expiry: preAdviceExpiry,
    }),
    transactionsService: createGateTransactionsService({ prisma }),
  });
  const gateStaff = requireRole('ADMIN', 'GATE_OPERATOR');
  const pinCheckLimiter = createRateLimiter({
    windowMs: PIN_CHECK_WINDOW_MS,
    limit: PIN_CHECKS_PER_WINDOW,
    message: 'Too many PIN checks from this device, please wait a few minutes',
  });
  const router = Router();
  router.use(requireAuth);
  router.post(
    '/verify-truck',
    gateStaff,
    pinCheckLimiter,
    validate({ body: verifyTruckBody }),
    controller.verifyTruck,
  );
  router.post('/in', gateStaff, validate({ body: gateInBody }), controller.gateIn);
  router.post('/out/check', gateStaff, validate({ body: gateOutBody }), controller.checkGateOut);
  router.post('/out', gateStaff, validate({ body: gateOutBody }), controller.completeGateOut);
  router.get(
    '/transactions',
    requireRole(...STAFF_ROLES),
    validate({ query: listTransactionsQuery }),
    controller.listTransactions,
  );
  router.get('/transactions/:id/eir.pdf', validate({ params: idParams }), controller.eirPdf);
  return router;
}
