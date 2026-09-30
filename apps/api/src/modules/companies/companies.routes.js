import { Router } from 'express';
import { idParams } from '../../lib/schemas.js';
import { requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createCompaniesController } from './companies.controller.js';
import { createCompanyBody, listCompaniesQuery, updateCompanyBody } from './companies.schemas.js';
import { createCompaniesService } from './companies.service.js';

export function createCompaniesRouter({ prisma, auditService, requireAuth }) {
  const controller = createCompaniesController({
    companiesService: createCompaniesService({ prisma, auditService }),
  });
  const router = Router();
  router.use(requireAuth, requireRole('ADMIN'));
  router.get('/', validate({ query: listCompaniesQuery }), controller.list);
  router.post('/', validate({ body: createCompanyBody }), controller.create);
  router.patch('/:id', validate({ params: idParams, body: updateCompanyBody }), controller.update);
  return router;
}
