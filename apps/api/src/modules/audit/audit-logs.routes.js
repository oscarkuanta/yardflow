import { Router } from 'express';
import { requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createAuditLogsController } from './audit-logs.controller.js';
import { exportAuditLogsQuery, listAuditLogsQuery } from './audit-logs.schemas.js';
import { createAuditLogsService } from './audit-logs.service.js';

export function createAuditLogsRouter({ prisma, requireAuth }) {
  const controller = createAuditLogsController({
    auditLogsService: createAuditLogsService({ prisma }),
  });
  const adminOnly = [requireAuth, requireRole('ADMIN')];
  const router = Router();
  router.get('/audit-logs', ...adminOnly, validate({ query: listAuditLogsQuery }), controller.list);
  router.get(
    '/audit-logs.csv',
    ...adminOnly,
    validate({ query: exportAuditLogsQuery }),
    controller.exportCsv,
  );
  return router;
}
