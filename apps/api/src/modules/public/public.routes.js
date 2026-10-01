import { Router } from 'express';
import { createPublicService } from './public.service.js';

export function createPublicRouter({ prisma, clock }) {
  const publicService = createPublicService({ prisma, clock });
  const router = Router();
  router.get('/stats', async (_request, response) => {
    response.json({ data: await publicService.stats() });
  });
  return router;
}
