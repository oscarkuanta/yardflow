import { Router } from 'express';
import { idParams } from '../../lib/schemas.js';
import { requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createPreAdvicesController } from './preadvices.controller.js';
import { createPreAdviceBody, listPreAdvicesQuery } from './preadvices.schemas.js';
import { createPreAdvicesService } from './preadvices.service.js';

export function createPreAdvicesRouter({
  prisma,
  auditService,
  eventBus,
  clock,
  config,
  requireAuth,
  preAdviceExpiry,
}) {
  const controller = createPreAdvicesController({
    preAdvicesService: createPreAdvicesService({
      prisma,
      auditService,
      eventBus,
      clock,
      config,
      expiry: preAdviceExpiry,
    }),
  });
  const router = Router();
  router.use(requireAuth);
  router.get(
    '/',
    requireRole('ADMIN', 'CUSTOMER'),
    validate({ query: listPreAdvicesQuery }),
    controller.list,
  );
  router.post(
    '/',
    requireRole('CUSTOMER'),
    validate({ body: createPreAdviceBody }),
    controller.create,
  );
  router.post(
    '/:id/regenerate-pin',
    requireRole('CUSTOMER'),
    validate({ params: idParams }),
    controller.regeneratePin,
  );
  router.post(
    '/:id/cancel',
    requireRole('ADMIN', 'CUSTOMER'),
    validate({ params: idParams }),
    controller.cancel,
  );
  return router;
}
