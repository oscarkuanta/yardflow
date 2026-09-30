import { describe, expect, jest, test } from '@jest/globals';
import { createRequireAuth, requireRole } from '../../../src/middleware/authenticate.js';

async function runMiddleware(middleware, incoming) {
  const next = jest.fn();
  await middleware(incoming, {}, next);
  return next;
}

function sessionFor(userId) {
  return { userId, destroy: jest.fn((callback) => callback()) };
}

function prismaReturning(user) {
  return { user: { findUnique: jest.fn().mockResolvedValue(user) } };
}

describe('requireRole', () => {
  test.each([
    ['ADMIN', ['ADMIN']],
    ['PLANNER', ['ADMIN', 'PLANNER']],
    ['CUSTOMER', ['CUSTOMER']],
  ])('lets a %s through when %j are allowed', async (role, allowedRoles) => {
    const next = await runMiddleware(requireRole(...allowedRoles), { user: { role } });
    expect(next).toHaveBeenCalledWith();
  });

  test.each([
    ['CUSTOMER', ['ADMIN', 'PLANNER', 'GATE_OPERATOR']],
    ['GATE_OPERATOR', ['ADMIN']],
    ['PLANNER', ['ADMIN', 'GATE_OPERATOR']],
  ])('answers 403 for a %s when only %j are allowed', async (role, allowedRoles) => {
    const next = await runMiddleware(requireRole(...allowedRoles), { user: { role } });
    expect(next.mock.calls[0][0]).toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  test('answers 401 when nobody is logged in', async () => {
    const next = await runMiddleware(requireRole('ADMIN'), {});
    expect(next.mock.calls[0][0]).toMatchObject({ status: 401, code: 'NOT_AUTHENTICATED' });
  });
});

describe('requireAuth', () => {
  test('answers 401 without a user in the session', async () => {
    const requireAuth = createRequireAuth({ prisma: prismaReturning(null) });
    const next = await runMiddleware(requireAuth, { session: {} });
    expect(next.mock.calls[0][0].status).toBe(401);
  });

  test('loads the active user onto the request', async () => {
    const user = { id: 3, role: 'PLANNER', isActive: true };
    const incoming = { session: sessionFor(3) };
    const next = await runMiddleware(
      createRequireAuth({ prisma: prismaReturning(user) }),
      incoming,
    );
    expect(next).toHaveBeenCalledWith();
    expect(incoming.user).toBe(user);
  });

  test.each([
    ['an inactive user', { id: 3, isActive: false }],
    ['a deleted user', null],
  ])('destroys the session of %s', async (_label, user) => {
    const incoming = { session: sessionFor(3) };
    const next = await runMiddleware(
      createRequireAuth({ prisma: prismaReturning(user) }),
      incoming,
    );
    expect(incoming.session.destroy).toHaveBeenCalled();
    expect(next.mock.calls[0][0].status).toBe(401);
    expect(incoming.user).toBeUndefined();
  });
});
