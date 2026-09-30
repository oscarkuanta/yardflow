import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { createContainersController } from './containers.controller.js';
import { containerNumberParams, listContainersQuery } from './containers.schemas.js';
import { createContainersService } from './containers.service.js';

export function createContainersRouter({ prisma, clock, requireAuth }) {
  const controller = createContainersController({
    containersService: createContainersService({ prisma, clock }),
  });
  const router = Router();
  router.use(requireAuth);
  router.get('/', validate({ query: listContainersQuery }), controller.list);
  router.get('/:number', validate({ params: containerNumberParams }), controller.detail);
  return router;
}
