import { Router } from 'express';
import { idParams } from '../../lib/schemas.js';
import { requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createNotificationsController } from './notifications.controller.js';
import { listNotificationsQuery } from './notifications.schemas.js';
import { createNotificationsService } from './notifications.service.js';

export function createNotificationsRouter({ prisma, clock, requireAuth }) {
  const controller = createNotificationsController({
    notificationsService: createNotificationsService({ prisma, clock }),
  });
  const router = Router();
  router.use(requireAuth, requireRole('CUSTOMER'));
  router.get('/', validate({ query: listNotificationsQuery }), controller.list);
  router.post('/read-all', controller.markAllRead);
  router.post('/:id/read', validate({ params: idParams }), controller.markRead);
  return router;
}
