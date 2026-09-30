import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { generateContainerNumber } from '@yardflow/shared';
import request from 'supertest';
import { createUsersForAllRoles, loginAllRoles, resetDatabase } from '../helpers/fixtures.js';
import { createTestContext } from '../helpers/test-app.js';

const FIXED_NOW = new Date('2026-09-30T08:00:00Z');
const ALL_ROLES = ['ADMIN', 'PLANNER', 'GATE_OPERATOR', 'CUSTOMER'];
const STAFF = ['ADMIN', 'PLANNER', 'GATE_OPERATOR'];
const PLANNING = ['ADMIN', 'PLANNER'];
const GATE_STAFF = ['ADMIN', 'GATE_OPERATOR'];
const UNKNOWN_CONTAINER = generateContainerNumber('ZZZU', 1);

const ENDPOINTS = [
  ['get', '/users', ['ADMIN']],
  ['post', '/users', ['ADMIN']],
  ['patch', '/users/999999', ['ADMIN']],
  ['get', '/companies', ['ADMIN']],
  ['post', '/companies', ['ADMIN']],
  ['patch', '/companies/999999', ['ADMIN']],
  ['get', '/blocks', STAFF],
  ['post', '/blocks', ['ADMIN']],
  ['patch', '/blocks/999999', ['ADMIN']],
  ['get', '/tariffs', ['ADMIN']],
  ['patch', '/tariffs', ['ADMIN']],
  ['get', '/time-slots?date=2026-10-01', ['ADMIN', 'CUSTOMER']],
  ['patch', '/time-slots', ['ADMIN']],
  ['get', '/containers', ALL_ROLES],
  ['get', `/containers/${UNKNOWN_CONTAINER}`, ALL_ROLES],
  ['get', '/yard/map', STAFF],
  ['get', '/yard/stacks/B/1/1', STAFF],
  ['post', '/yard/suggestions', STAFF],
  ['post', '/yard/moves', PLANNING],
  ['get', '/work-orders', PLANNING],
  ['post', '/work-orders/999999/complete', PLANNING],
  ['get', '/vessel-visits', PLANNING],
  ['post', '/vessel-visits', PLANNING],
  ['get', '/vessel-visits/999999', PLANNING],
  ['patch', '/vessel-visits/999999', PLANNING],
  ['post', '/vessel-visits/999999/items', PLANNING],
  ['post', '/vessel-visits/999999/items/import', PLANNING],
  ['post', '/vessel-visits/999999/items/1/discharge', PLANNING],
  ['post', '/vessel-visits/999999/items/1/load', PLANNING],
  ['get', '/pre-advices', ['ADMIN', 'CUSTOMER']],
  ['post', '/pre-advices', ['CUSTOMER']],
  ['post', '/pre-advices/999999/regenerate-pin', ['CUSTOMER']],
  ['post', '/pre-advices/999999/cancel', ['ADMIN', 'CUSTOMER']],
  ['post', '/gate/verify-truck', GATE_STAFF],
  ['post', '/gate/in', GATE_STAFF],
  ['post', '/gate/out/check', GATE_STAFF],
  ['post', '/gate/out', GATE_STAFF],
  ['get', '/gate/transactions', STAFF],
  ['get', '/gate/transactions/999999/eir.pdf', ALL_ROLES],
];

const CASES = ENDPOINTS.flatMap(([method, path, allowedRoles]) =>
  ALL_ROLES.map((role) => [method.toUpperCase(), path, role, allowedRoles.includes(role)]),
);

describe('role checks on every route', () => {
  const context = createTestContext({ clock: () => FIXED_NOW });
  let agents;

  beforeAll(async () => {
    await resetDatabase(context.prisma);
    await createUsersForAllRoles(context.prisma);
    agents = await loginAllRoles(context.app);
  });

  afterAll(context.close);

  test.each(ENDPOINTS)('%s %s answers 401 without a session', async (method, path) => {
    const response = await request(context.app)[method](`/api/v1${path}`);
    expect(response.status).toBe(401);
  });

  test.each(CASES)('%s %s as %s is allowed: %s', async (method, path, role, isAllowed) => {
    const response = await agents[role][method.toLowerCase()](`/api/v1${path}`).send({});
    if (isAllowed) {
      expect([401, 403]).not.toContain(response.status);
    } else {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    }
  });
});
