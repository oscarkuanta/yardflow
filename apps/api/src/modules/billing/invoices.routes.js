import { Router } from 'express';
import { idParams } from '../../lib/schemas.js';
import { requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createInvoicesController } from './invoices.controller.js';
import { listInvoicesQuery } from './invoices.schemas.js';
import { createInvoicesService } from './invoices.service.js';

export function createInvoicesRouter({ prisma, auditService, eventBus, clock, requireAuth }) {
  const controller = createInvoicesController({
    invoicesService: createInvoicesService({ prisma, auditService, eventBus, clock }),
  });
  const adminOrCustomer = requireRole('ADMIN', 'CUSTOMER');
  const router = Router();
  router.use(requireAuth);
  router.get('/', adminOrCustomer, validate({ query: listInvoicesQuery }), controller.list);
  router.post(
    '/:id/mark-paid',
    requireRole('ADMIN'),
    validate({ params: idParams }),
    controller.markPaid,
  );
  router.get('/:id/pdf', adminOrCustomer, validate({ params: idParams }), controller.pdf);
  return router;
}
