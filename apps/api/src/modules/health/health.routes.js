import { Router } from 'express';

export function createHealthRouter({ prisma }) {
  const router = Router();
  router.get('/', async (request, response) => {
    const uptimeSeconds = Math.round(process.uptime());
    try {
      await prisma.$queryRaw`SELECT 1`;
      response.json({ status: 'ok', database: 'up', uptimeSeconds });
    } catch (error) {
      request.log?.warn({ err: error }, 'Health check could not reach the database');
      response.status(503).json({ status: 'error', database: 'down', uptimeSeconds });
    }
  });
  return router;
}
