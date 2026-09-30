import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import { WORK_ORDER_CHANGED, YARD_CHANGED, createEventBus } from '../../src/lib/event-bus.js';
import { createAuditService } from '../../src/modules/audit/audit.service.js';
import { createRelocationWorkOrders } from '../../src/modules/workorders/workorders.service.js';
import {
  USER_EMAILS,
  createBlock,
  createSmallYard,
  createUsersForAllRoles,
  loginAs,
  placeContainer,
  recordEvents,
  resetDatabase,
} from '../helpers/fixtures.js';
import { createTestContext } from '../helpers/test-app.js';

const WORK_ORDERS_PATH = '/api/v1/work-orders';

describe('relocation work orders', () => {
  const eventBus = createEventBus();
  const { app, prisma, close } = createTestContext({ eventBus });
  const auditService = createAuditService({ prisma });
  let planner;
  let users;
  let company;
  let yard;
  let stack;

  function createGroup(targetContainerId) {
    return prisma.$transaction((transaction) =>
      createRelocationWorkOrders(transaction, {
        targetContainerId,
        reason: 'Unblock for gate-out',
        actor: { id: users.PLANNER.id, ip: '127.0.0.1' },
        auditService,
      }),
    );
  }

  beforeEach(async () => {
    await resetDatabase(prisma);
    ({ users, company } = await createUsersForAllRoles(prisma));
    yard = await createSmallYard(prisma);
    stack = [];
    for (const tier of [1, 2, 3]) {
      stack.push(
        await placeContainer(prisma, {
          block: yard.B,
          row: 1,
          bay: 1,
          tier,
          companyId: company.id,
        }),
      );
    }
    planner = await loginAs(app, USER_EMAILS.PLANNER);
  });

  afterAll(close);

  describe('createRelocationWorkOrders (spec 6.5)', () => {
    test('creates one work order per blocker in one group, top container first', async () => {
      const workOrders = await createGroup(stack[0].id);
      expect(
        workOrders.map((order) => [order.sequence, order.container.number, order.fromPosition]),
      ).toEqual([
        [1, stack[2].number, 'B-01-01-3'],
        [2, stack[1].number, 'B-01-01-2'],
      ]);
      expect(new Set(workOrders.map((order) => order.groupKey)).size).toBe(1);
      expect(workOrders.every((order) => order.targetContainerId === stack[0].id)).toBe(true);
      const destinations = workOrders.map((order) => order.toPosition);
      expect(new Set(destinations).size).toBe(2);
      expect(destinations.every((code) => !code.startsWith('B-01-01'))).toBe(true);
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'CREATE_RELOCATION' },
      });
      expect(audit.entityId).toBe(workOrders[0].groupKey);
    });

    test('reuses the open group instead of creating a second one', async () => {
      const first = await createGroup(stack[0].id);
      const second = await createGroup(stack[0].id);
      expect(second.map((order) => order.id)).toEqual(first.map((order) => order.id));
      expect(await prisma.workOrder.count()).toBe(2);
    });

    test('creates nothing for a container on top', async () => {
      expect(await createGroup(stack[2].id)).toEqual([]);
    });

    test('answers 409 when the yard has no room for the blockers', async () => {
      await resetDatabase(prisma);
      ({ users, company } = await createUsersForAllRoles(prisma));
      const onlyStack = await createBlock(prisma, { rows: 1, bays: 1, maxTier: 3 });
      const target = await placeContainer(prisma, {
        block: onlyStack,
        row: 1,
        bay: 1,
        tier: 1,
        companyId: company.id,
      });
      await placeContainer(prisma, {
        block: onlyStack,
        row: 1,
        bay: 1,
        tier: 2,
        companyId: company.id,
      });
      await expect(createGroup(target.id)).rejects.toMatchObject({
        status: 409,
        code: 'NO_FREE_SLOT',
      });
    });
  });

  describe('GET /work-orders', () => {
    test('lists work orders with container and target numbers, filtered by status and group', async () => {
      const [first] = await createGroup(stack[0].id);
      const response = await planner.get(
        `${WORK_ORDERS_PATH}?status=OPEN&groupKey=${first.groupKey}`,
      );
      expect(response.status).toBe(200);
      expect(response.body.total).toBe(2);
      expect(response.body.data[0]).toMatchObject({
        sequence: 1,
        status: 'OPEN',
        containerNumber: stack[2].number,
        targetContainerNumber: stack[0].number,
        fromPosition: 'B-01-01-3',
        completedBy: null,
      });
      const done = await planner.get(`${WORK_ORDERS_PATH}?status=DONE`);
      expect(done.body.total).toBe(0);
    });

    test('finds the group of a target container by its number', async () => {
      await createGroup(stack[0].id);
      const response = await planner.get(`${WORK_ORDERS_PATH}?containerNumber=${stack[0].number}`);
      expect(response.body.total).toBe(2);
    });

    test('rejects an unknown status with 422', async () => {
      expect((await planner.get(`${WORK_ORDERS_PATH}?status=LATE`)).status).toBe(422);
    });
  });

  describe('POST /work-orders/:id/complete', () => {
    test('refuses to complete sequence 2 before sequence 1', async () => {
      const [, second] = await createGroup(stack[0].id);
      const response = await planner.post(`${WORK_ORDERS_PATH}/${second.id}/complete`);
      expect(response.status).toBe(409);
      expect(response.body.error).toMatchObject({
        code: 'WORK_ORDER_OUT_OF_SEQUENCE',
        message: 'Complete work order 1 of this group first',
      });
    });

    test('moves the container to the planned slot, records a relocation and emits events', async () => {
      const events = recordEvents(eventBus, [YARD_CHANGED, WORK_ORDER_CHANGED]);
      const [first] = await createGroup(stack[0].id);
      const response = await planner.post(`${WORK_ORDERS_PATH}/${first.id}/complete`);
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        status: 'DONE',
        toPosition: first.toPosition,
        completedBy: { id: users.PLANNER.id, name: 'Test planner' },
      });
      const movement = await prisma.movement.findFirstOrThrow({
        where: { containerId: stack[2].id },
      });
      expect(movement).toMatchObject({
        type: 'RELOCATION',
        fromPosition: 'B-01-01-3',
        toPosition: first.toPosition,
      });
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'COMPLETE' } });
      expect(audit.after).toMatchObject({ replanned: false, toPosition: first.toPosition });
      expect(events.map((event) => event.eventName)).toEqual([YARD_CHANGED, WORK_ORDER_CHANGED]);
      expect(events[1].payload).toEqual({ id: first.id, groupKey: first.groupKey, status: 'DONE' });
    });

    test('completes a whole group in order and leaves the target on top', async () => {
      const [first, second] = await createGroup(stack[0].id);
      await planner.post(`${WORK_ORDERS_PATH}/${first.id}/complete`);
      const response = await planner.post(`${WORK_ORDERS_PATH}/${second.id}/complete`);
      expect(response.status).toBe(200);
      expect(
        await prisma.containerPosition.count({ where: { blockId: yard.B.id, row: 1, bay: 1 } }),
      ).toBe(1);
      expect(await prisma.workOrder.count({ where: { status: 'OPEN' } })).toBe(0);
    });

    test('refuses to complete a work order twice', async () => {
      const [first] = await createGroup(stack[0].id);
      await planner.post(`${WORK_ORDERS_PATH}/${first.id}/complete`);
      const response = await planner.post(`${WORK_ORDERS_PATH}/${first.id}/complete`);
      expect(response.status).toBe(409);
      expect(response.body.error).toMatchObject({
        code: 'WORK_ORDER_NOT_OPEN',
        message: `Work order ${first.id} is already DONE`,
      });
    });

    test('picks the next best slot when the planned one is no longer valid, and audits why', async () => {
      const [first] = await createGroup(stack[0].id);
      const planned = first.toPosition.split('-');
      await placeContainer(prisma, {
        block: yard.B,
        row: Number(planned[1]),
        bay: Number(planned[2]),
        tier: 1,
        companyId: company.id,
        size: 'FT45',
      });
      const response = await planner.post(`${WORK_ORDERS_PATH}/${first.id}/complete`);
      expect(response.status).toBe(200);
      expect(response.body.data.toPosition).not.toBe(first.toPosition);
      expect(response.body.data.toPosition.startsWith('B-01-01')).toBe(false);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'COMPLETE' } });
      expect(audit.before.plannedTo).toBe(first.toPosition);
      expect(audit.after).toMatchObject({
        replanned: true,
        replanReason: 'A 40 ft container cannot sit on a 45 ft container',
      });
    });

    test('answers 404 for an unknown work order', async () => {
      expect((await planner.post(`${WORK_ORDERS_PATH}/999999/complete`)).status).toBe(404);
    });
  });
});
