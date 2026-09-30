import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import { generateContainerNumber } from '@yardflow/shared';
import { YARD_CHANGED, createEventBus } from '../../src/lib/event-bus.js';
import {
  USER_EMAILS,
  createContainer,
  createHold,
  createSmallYard,
  createUsersForAllRoles,
  loginAs,
  placeContainer,
  recordEvents,
  resetDatabase,
} from '../helpers/fixtures.js';
import { createTestContext } from '../helpers/test-app.js';

const MOVES_PATH = '/api/v1/yard/moves';
const UNKNOWN_VALID_NUMBER = generateContainerNumber('ZZZU', 1);

describe('yard', () => {
  const eventBus = createEventBus();
  const { app, prisma, close } = createTestContext({ eventBus });
  let planner;
  let users;
  let company;
  let yard;
  let stackB0101;

  beforeEach(async () => {
    await resetDatabase(prisma);
    ({ users, company } = await createUsersForAllRoles(prisma));
    yard = await createSmallYard(prisma);
    stackB0101 = [];
    for (const tier of [1, 2, 3]) {
      stackB0101.push(
        await placeContainer(prisma, {
          block: yard.B,
          row: 1,
          bay: 1,
          tier,
          companyId: company.id,
        }),
      );
    }
    await createHold(prisma, { containerId: stackB0101[1].id, placedById: users.ADMIN.id });
    planner = await loginAs(app, USER_EMAILS.PLANNER);
  });

  afterAll(close);

  describe('GET /yard/map', () => {
    test('returns every block with every stack, its height, top size, holds and DG flag', async () => {
      const gate = await loginAs(app, USER_EMAILS.GATE_OPERATOR);
      const response = await gate.get('/api/v1/yard/map');
      expect(response.status).toBe(200);
      expect(response.body.data.map((block) => block.code)).toEqual(['A', 'B', 'E', 'X']);
      const blockB = response.body.data[1];
      expect(blockB.stacks).toHaveLength(6);
      expect(blockB.occupancy).toMatchObject({ usedSlots: 3, capacitySlots: 18 });
      expect(blockB.stacks[0]).toEqual({
        row: 1,
        bay: 1,
        stackCode: 'B-01-01',
        height: 3,
        topSize: 'FT40',
        hasHold: true,
        hasDangerous: false,
      });
      expect(blockB.stacks[1]).toMatchObject({ height: 0, topSize: null, hasHold: false });
    });

    test('flags stacks that hold dangerous goods', async () => {
      await placeContainer(prisma, {
        block: yard.X,
        row: 1,
        bay: 2,
        tier: 1,
        companyId: company.id,
        size: 'FT20',
        isDangerous: true,
        imoClass: '3',
      });
      const response = await planner.get('/api/v1/yard/map');
      const blockX = response.body.data.find((block) => block.code === 'X');
      expect(blockX.stacks.map((stack) => stack.hasDangerous)).toEqual([false, true]);
    });
  });

  describe('GET /yard/stacks/:block/:row/:bay', () => {
    test('shows the side view from the bottom up with owner and hold badge', async () => {
      const response = await planner.get('/api/v1/yard/stacks/b/1/1');
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        stackCode: 'B-01-01',
        maxTier: 3,
        height: 3,
      });
      expect(
        response.body.data.tiers.map(({ positionCode, container }) => [
          positionCode,
          container.number,
          container.hasHold,
        ]),
      ).toEqual([
        ['B-01-01-1', stackB0101[0].number, false],
        ['B-01-01-2', stackB0101[1].number, true],
        ['B-01-01-3', stackB0101[2].number, false],
      ]);
      expect(response.body.data.tiers[0].container.owner).toEqual({
        id: company.id,
        code: 'TST',
        name: 'Test Freight',
      });
    });

    test('shows an empty stack', async () => {
      const response = await planner.get('/api/v1/yard/stacks/B/2/3');
      expect(response.body.data).toMatchObject({ height: 0, tiers: [] });
    });

    test.each([
      ['/api/v1/yard/stacks/Q/1/1', 404],
      ['/api/v1/yard/stacks/B/3/1', 404],
      ['/api/v1/yard/stacks/B/1/4', 404],
      ['/api/v1/yard/stacks/B/0/1', 422],
    ])('answers %s with %i', async (path, status) => {
      expect((await planner.get(path)).status).toBe(status);
    });
  });

  describe('POST /yard/suggestions', () => {
    test('returns the top 3 slots with score, reasons and the maximum tier', async () => {
      const response = await planner
        .post('/api/v1/yard/suggestions')
        .send({ size: 'FT40', loadStatus: 'FULL', isDangerous: false, ownerCompanyId: company.id });
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0]).toMatchObject({
        positionCode: 'B-02-01-1',
        score: 96,
        distanceM: 43,
        maxTier: 3,
        reasons: ['Empty stack', 'Tier 1 of 3', '43 m to gate'],
      });
      expect(response.body.data.map((item) => item.positionCode)).not.toContain('B-01-01-4');
    });

    test('keeps dangerous goods in the DG block', async () => {
      const response = await planner
        .post('/api/v1/yard/suggestions')
        .send({ size: 'FT20', loadStatus: 'FULL', isDangerous: true });
      expect(response.body.data.map((item) => item.blockCode)).toEqual(['X', 'X']);
    });

    test('answers 409 when no stack fits the container type', async () => {
      const response = await planner
        .post('/api/v1/yard/suggestions')
        .send({ size: 'FT20', loadStatus: 'EMPTY' });
      expect(response.status).toBe(409);
      expect(response.body.error).toMatchObject({
        code: 'NO_FREE_SLOT',
        message: 'No free slot for this container type',
      });
    });

    test('rejects unknown attributes with 422', async () => {
      const response = await planner
        .post('/api/v1/yard/suggestions')
        .send({ size: 'FT30', loadStatus: 'FULL' });
      expect(response.status).toBe(422);
    });
  });

  describe('POST /yard/moves', () => {
    test('moves the top container, records a movement and an audit entry, and emits an event', async () => {
      const events = recordEvents(eventBus, [YARD_CHANGED]);
      const top = stackB0101[2];
      const response = await planner
        .post(MOVES_PATH)
        .send({ containerNumber: top.number.toLowerCase(), to: 'b-02-03' });
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        containerNumber: top.number,
        fromPosition: 'B-01-01-3',
        toPosition: 'B-02-03-1',
      });
      const position = await prisma.containerPosition.findUniqueOrThrow({
        where: { containerId: top.id },
      });
      expect(position).toMatchObject({ blockId: yard.B.id, row: 2, bay: 3, tier: 1 });
      const movement = await prisma.movement.findFirstOrThrow({ where: { containerId: top.id } });
      expect(movement).toMatchObject({
        type: 'YARD_MOVE',
        fromPosition: 'B-01-01-3',
        toPosition: 'B-02-03-1',
        userId: users.PLANNER.id,
      });
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'MOVE' } });
      expect(audit).toMatchObject({ entity: 'Container', entityId: top.number });
      expect(events).toEqual([
        {
          eventName: YARD_CHANGED,
          payload: {
            changes: [
              { positionCode: 'B-01-01-3', containerNumber: top.number, action: 'REMOVED' },
              { positionCode: 'B-02-03-1', containerNumber: top.number, action: 'PLACED' },
            ],
          },
        },
      ]);
    });

    test('refuses to move a container that has containers above it', async () => {
      const response = await planner
        .post(MOVES_PATH)
        .send({ containerNumber: stackB0101[0].number, to: 'B-02-03' });
      expect(response.status).toBe(409);
      expect(response.body.error).toMatchObject({
        code: 'CONTAINER_BLOCKED',
        message: 'Container is blocked by 2 containers above it',
      });
    });

    test.each([
      ['A-01-01', 'A 40 ft container needs a LARGE block, block A is SMALL'],
      ['E-01-01', 'Full containers go only to STANDARD blocks, block E is EMPTY'],
      ['B-02-03-2', 'The next free tier on B-02-03 is 1, not 2'],
      ['B-03-01', 'Block B has rows 1 to 2 and bays 1 to 3'],
    ])('refuses %s and names the broken rule', async (to, message) => {
      const response = await planner
        .post(MOVES_PATH)
        .send({ containerNumber: stackB0101[2].number, to });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('STACKING_RULE_BROKEN');
      expect(response.body.error.message).toContain(message);
    });

    test('refuses a full stack and a different size on top', async () => {
      const fortyFive = await placeContainer(prisma, {
        block: yard.B,
        row: 2,
        bay: 1,
        tier: 1,
        companyId: company.id,
        size: 'FT45',
      });
      const full = await planner
        .post(MOVES_PATH)
        .send({ containerNumber: fortyFive.number, to: 'B-01-01' });
      expect(full.body.error.message).toContain('Stack B-01-01 is full (3 of 3 tiers)');
      const mixed = await planner
        .post(MOVES_PATH)
        .send({ containerNumber: stackB0101[2].number, to: 'B-02-01' });
      expect(mixed.body.error.message).toBe('A 40 ft container cannot sit on a 45 ft container');
    });

    test('refuses a move into the same stack', async () => {
      const response = await planner
        .post(MOVES_PATH)
        .send({ containerNumber: stackB0101[2].number, to: 'B-01-01' });
      expect(response.body.error.code).toBe('SAME_STACK');
    });

    test('lets only one of two moves into the same slot succeed', async () => {
      const other = await placeContainer(prisma, {
        block: yard.B,
        row: 2,
        bay: 1,
        tier: 1,
        companyId: company.id,
      });
      const admin = await loginAs(app, USER_EMAILS.ADMIN);
      const responses = await Promise.all([
        planner.post(MOVES_PATH).send({ containerNumber: stackB0101[2].number, to: 'B-02-02-1' }),
        admin.post(MOVES_PATH).send({ containerNumber: other.number, to: 'B-02-02-1' }),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
      expect(
        await prisma.containerPosition.count({ where: { blockId: yard.B.id, row: 2, bay: 2 } }),
      ).toBe(1);
    });

    test('stacks two moves into the same stack on top of each other without a gap', async () => {
      const other = await placeContainer(prisma, {
        block: yard.B,
        row: 2,
        bay: 1,
        tier: 1,
        companyId: company.id,
      });
      const admin = await loginAs(app, USER_EMAILS.ADMIN);
      const responses = await Promise.all([
        planner.post(MOVES_PATH).send({ containerNumber: stackB0101[2].number, to: 'B-02-02' }),
        admin.post(MOVES_PATH).send({ containerNumber: other.number, to: 'B-02-02' }),
      ]);
      expect(responses.map((response) => response.body.data.toPosition).sort()).toEqual([
        'B-02-02-1',
        'B-02-02-2',
      ]);
    });

    test('refuses containers that are not in the yard', async () => {
      const expected = await createContainer(prisma, { companyId: company.id, state: 'EXPECTED' });
      const response = await planner
        .post(MOVES_PATH)
        .send({ containerNumber: expected.number, to: 'B-02-02' });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONTAINER_NOT_IN_YARD');
    });

    test.each([
      [{ containerNumber: UNKNOWN_VALID_NUMBER, to: 'B-02-02' }, 404],
      [{ containerNumber: 'TSTU0000012', to: 'B-02-02' }, 422],
      [{ containerNumber: 'TST0000012', to: 'B-02-02' }, 422],
      [{ containerNumber: UNKNOWN_VALID_NUMBER, to: 'somewhere' }, 422],
    ])('answers %j with %i', async (body, status) => {
      const response = await planner.post(MOVES_PATH).send(body);
      expect(response.status).toBe(status);
    });

    test('answers 422 for a block that does not exist', async () => {
      const response = await planner
        .post(MOVES_PATH)
        .send({ containerNumber: stackB0101[2].number, to: 'Q-01-01' });
      expect(response.status).toBe(422);
      expect(response.body.error.details[0].message).toBe('Block Q does not exist');
    });

    test('uses the exact ISO 6346 messages', async () => {
      const response = await planner
        .post(MOVES_PATH)
        .send({ containerNumber: 'CSQU3054384', to: 'B-02-02' });
      expect(response.body.error.details[0]).toEqual({
        field: 'body.containerNumber',
        message: 'Invalid container number: check digit does not match',
      });
    });
  });
});
