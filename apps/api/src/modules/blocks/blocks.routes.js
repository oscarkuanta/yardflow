import { STAFF_ROLES } from '@yardflow/shared';
import { Router } from 'express';
import { idParams } from '../../lib/schemas.js';
import { requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createBlocksController } from './blocks.controller.js';
import { createBlockBody, listBlocksQuery, updateBlockBody } from './blocks.schemas.js';
import { createBlocksService } from './blocks.service.js';

export function createBlocksRouter({ prisma, auditService, requireAuth }) {
  const controller = createBlocksController({
    blocksService: createBlocksService({ prisma, auditService }),
  });
  const router = Router();
  router.use(requireAuth);
  router.get(
    '/',
    requireRole(...STAFF_ROLES),
    validate({ query: listBlocksQuery }),
    controller.list,
  );
  router.post('/', requireRole('ADMIN'), validate({ body: createBlockBody }), controller.create);
  router.patch(
    '/:id',
    requireRole('ADMIN'),
    validate({ params: idParams, body: updateBlockBody }),
    controller.update,
  );
  return router;
}
