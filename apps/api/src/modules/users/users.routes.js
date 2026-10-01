import { Router } from 'express';
import { idParams } from '../../lib/schemas.js';
import { requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createUsersController } from './users.controller.js';
import { createUserBody, listUsersQuery, updateUserBody } from './users.schemas.js';
import { createUsersService } from './users.service.js';

export function createUsersRouter({ prisma, auditService, eventBus, requireAuth }) {
  const controller = createUsersController({
    usersService: createUsersService({ prisma, auditService, eventBus }),
  });
  const router = Router();
  router.use(requireAuth, requireRole('ADMIN'));
  router.get('/', validate({ query: listUsersQuery }), controller.list);
  router.post('/', validate({ body: createUserBody }), controller.create);
  router.patch('/:id', validate({ params: idParams, body: updateUserBody }), controller.update);
  return router;
}
