import { describe, expect, jest, test } from '@jest/globals';
import { listQuerySchema } from '../../src/lib/pagination.js';
import { isUniqueViolation, rethrowUniqueViolation } from '../../src/lib/prisma-errors.js';
import { destroySessionsOfUsers } from '../../src/lib/user-sessions.js';
import {
  changesStackingClass,
  describeOccupancy,
  positionsOutside,
} from '../../src/modules/blocks/block-geometry.js';
import {
  SLOT_START_HOURS,
  isBeyondHorizon,
  isInCreationWindow,
  isOperatingDay,
  slotsBookedBeyond,
} from '../../src/modules/timeslots/slot-calendar.js';
import { companyRuleProblem, ownAccessProblem } from '../../src/modules/users/users.rules.js';

const TODAY = { year: 2026, month: 9, day: 30 };

describe('user rules', () => {
  test.each([
    ['CUSTOMER', null, 'A customer user must belong to a company'],
    ['CUSTOMER', 3, null],
    ['ADMIN', 3, 'Staff users cannot belong to a company'],
    ['GATE_OPERATOR', null, null],
  ])('%s with company %s gives %s', (role, companyId, expected) => {
    expect(companyRuleProblem(role, companyId)).toBe(expected);
  });

  test('only protects the acting admin from locking themselves out', () => {
    expect(ownAccessProblem({ actorId: 1, userId: 2, changes: { isActive: false } })).toBeNull();
    expect(ownAccessProblem({ actorId: 1, userId: 1, changes: { role: 'ADMIN' } })).toBeNull();
    expect(ownAccessProblem({ actorId: 1, userId: 1, changes: { name: 'New' } })).toBeNull();
    expect(ownAccessProblem({ actorId: 1, userId: 1, changes: { isActive: false } })).toBe(
      'You cannot deactivate your own account',
    );
  });
});

describe('block geometry', () => {
  const block = { rows: 5, bays: 10, maxTier: 4, sizeClass: 'LARGE', type: 'STANDARD' };

  test('describes occupancy in slots, percent and TEU', () => {
    expect(describeOccupancy(block, 50)).toEqual({
      capacitySlots: 200,
      usedSlots: 50,
      freeSlots: 150,
      occupancyPercent: 25,
      teuCapacity: 400,
      teuUsed: 100,
    });
    expect(describeOccupancy({ ...block, sizeClass: 'SMALL' }, 3).teuUsed).toBe(3);
  });

  test('reports 0 percent for a block without slots', () => {
    expect(describeOccupancy({ ...block, rows: 0 }, 0).occupancyPercent).toBe(0);
  });

  test('finds positions outside a smaller geometry', () => {
    const positions = [
      { row: 5, bay: 1, tier: 1 },
      { row: 1, bay: 10, tier: 1 },
      { row: 1, bay: 1, tier: 4 },
      { row: 1, bay: 1, tier: 1 },
    ];
    expect(positionsOutside({ rows: 4, bays: 9, maxTier: 3 }, positions)).toHaveLength(3);
    expect(positionsOutside(block, positions)).toHaveLength(0);
  });

  test('notices a change of type or size class only when the value differs', () => {
    expect(changesStackingClass(block, { type: 'STANDARD' })).toBe(false);
    expect(changesStackingClass(block, { sizeClass: 'SMALL' })).toBe(true);
    expect(changesStackingClass(block, { rows: 3 })).toBe(false);
  });
});

describe('slot calendar', () => {
  test('has hourly slots from 08:00, the last one starting at 16:00', () => {
    expect(SLOT_START_HOURS).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16]);
  });

  test('is closed on Sunday only', () => {
    expect(isOperatingDay({ year: 2026, month: 10, day: 4 })).toBe(false);
    expect(isOperatingDay({ year: 2026, month: 10, day: 3 })).toBe(true);
  });

  test('creates slots from today up to 14 days ahead', () => {
    expect(isInCreationWindow({ year: 2026, month: 9, day: 29 }, TODAY)).toBe(false);
    expect(isInCreationWindow(TODAY, TODAY)).toBe(true);
    expect(isInCreationWindow({ year: 2026, month: 10, day: 14 }, TODAY)).toBe(true);
    expect(isBeyondHorizon({ year: 2026, month: 10, day: 15 }, TODAY)).toBe(true);
  });

  test('lists slots whose bookings exceed a new capacity', () => {
    const slots = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const booked = new Map([
      [1, 4],
      [2, 2],
    ]);
    expect(slotsBookedBeyond(slots, booked, 3)).toEqual([{ slot: { id: 1 }, booked: 4 }]);
  });
});

describe('list query schema', () => {
  const schema = listQuerySchema({ sortFields: ['name', 'id'], defaultSort: 'name:asc' });

  test('fills in page 1, 25 per page and the default sort', () => {
    expect(schema.parse({})).toEqual({
      page: 1,
      pageSize: 25,
      sort: { field: 'name', direction: 'asc' },
    });
  });

  test('parses page numbers and the sort from query strings', () => {
    expect(schema.parse({ page: '3', pageSize: '10', sort: 'id:desc' })).toEqual({
      page: 3,
      pageSize: 10,
      sort: { field: 'id', direction: 'desc' },
    });
  });

  test.each(['email:asc', 'name:up', 'name'])('rejects the sort %s', (sort) => {
    expect(schema.safeParse({ sort }).success).toBe(false);
  });
});

describe('prisma errors', () => {
  test('recognises a unique constraint violation', () => {
    expect(isUniqueViolation({ code: 'P2002' })).toBe(true);
    expect(isUniqueViolation({ code: 'P2025' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });

  test('turns only unique violations into the given conflict', async () => {
    const conflictError = new Error('taken');
    await expect(
      rethrowUniqueViolation(
        () => Promise.reject({ code: 'P2002' }),
        () => conflictError,
      ),
    ).rejects.toBe(conflictError);
    const otherError = new Error('connection lost');
    await expect(
      rethrowUniqueViolation(
        () => Promise.reject(otherError),
        () => conflictError,
      ),
    ).rejects.toBe(otherError);
    await expect(
      rethrowUniqueViolation(
        async () => 'ok',
        () => conflictError,
      ),
    ).resolves.toBe('ok');
  });
});

describe('destroySessionsOfUsers', () => {
  function prismaWithSessions(sessions) {
    return {
      session: {
        findMany: jest.fn().mockResolvedValue(sessions),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
  }

  test('deletes only sessions whose user id matches exactly', async () => {
    const prisma = prismaWithSessions([
      { sessionId: 'a', data: '{"cookie":{},"userId":1}' },
      { sessionId: 'b', data: '{"cookie":{},"userId":12}' },
      { sessionId: 'c', data: 'not json' },
      { sessionId: 'd', data: null },
    ]);
    expect(await destroySessionsOfUsers(prisma, [1])).toBe(1);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: { in: ['a'] } },
    });
  });

  test('does nothing for an empty list of users', async () => {
    const prisma = prismaWithSessions([]);
    expect(await destroySessionsOfUsers(prisma, [])).toBe(0);
    expect(prisma.session.findMany).not.toHaveBeenCalled();
  });

  test('skips the delete when no session matches', async () => {
    const prisma = prismaWithSessions([{ sessionId: 'b', data: '{"userId":12}' }]);
    expect(await destroySessionsOfUsers(prisma, [1])).toBe(0);
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
  });
});
