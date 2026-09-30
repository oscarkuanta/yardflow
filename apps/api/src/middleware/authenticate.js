import { forbidden, notAuthenticated } from '../lib/errors.js';
import { destroySession } from '../lib/session.js';

export const CURRENT_USER_INCLUDE = { company: { select: { id: true, code: true, name: true } } };

export function createRequireAuth({ prisma }) {
  return async function requireAuth(request, _response, next) {
    const userId = request.session?.userId;
    if (!userId) {
      next(notAuthenticated());
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: CURRENT_USER_INCLUDE,
    });
    if (!user || !user.isActive) {
      await destroySession(request);
      next(notAuthenticated('Your session has ended, please log in again'));
      return;
    }
    request.user = user;
    next();
  };
}

export function requireRole(...allowedRoles) {
  return function checkRole(request, _response, next) {
    if (!request.user) {
      next(notAuthenticated());
      return;
    }
    if (!allowedRoles.includes(request.user.role)) {
      next(forbidden());
      return;
    }
    next();
  };
}
