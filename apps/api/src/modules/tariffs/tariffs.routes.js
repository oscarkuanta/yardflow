import { Router } from 'express';
import { requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createTariffsController } from './tariffs.controller.js';
import { listTariffsQuery, updateTariffBody } from './tariffs.schemas.js';
import { createTariffsService } from './tariffs.service.js';

export function createTariffsRouter({ prisma, auditService, requireAuth }) {
  const controller = createTariffsController({
    tariffsService: createTariffsService({ prisma, auditService }),
  });
  const router = Router();
  router.use(requireAuth, requireRole('ADMIN'));
  router.get('/', validate({ query: listTariffsQuery }), controller.list);
  router.patch('/', validate({ body: updateTariffBody }), controller.update);
  return router;
}
