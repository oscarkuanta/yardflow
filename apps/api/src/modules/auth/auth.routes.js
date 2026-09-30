import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { createAuthController } from './auth.controller.js';
import { loginBodySchema } from './auth.schemas.js';
import { createAuthService } from './auth.service.js';

export function createAuthRouter({ prisma, auditService, requireAuth, loginRateLimiter }) {
  const controller = createAuthController({
    authService: createAuthService({ prisma, auditService }),
  });
  const router = Router();
  router.post('/login', loginRateLimiter, validate({ body: loginBodySchema }), controller.login);
  router.post('/logout', requireAuth, controller.logout);
  router.get('/me', requireAuth, controller.me);
  return router;
}
