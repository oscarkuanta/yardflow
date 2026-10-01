import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import { generateContainerNumber } from '@yardflow/shared';
import {
  CONTAINER_CHANGED,
  NOTIFICATION_NEW,
  YARD_CHANGED,
  createEventBus,
} from '../../src/lib/event-bus.js';
import {
  USER_EMAILS,
  createBookedPreAdvice,
  createContainer,
  createSmallYard,
  createTimeSlot,
  createUsersForAllRoles,
  loginAs,
  placeContainer,
  recordEvents,
  resetDatabase,
} from '../helpers/fixtures.js';
import { createTestContext } from '../helpers/test-app.js';

const HOLDS_PATH = '/api/v1/customs-holds';
const REASON = 'X-ray inspection requested';

describe('customs holds (spec 6.11)', () => {
  const eventBus = createEventBus();
  const { app, prisma, close } = createTestContext({ eventBus });
  let admin;
  let users;
  let company;
  let container;

  beforeEach(async () => {
    await resetDatabase(prisma);
    ({ users, company } = await createUsersForAllRoles(prisma));
    const yard = await createSmallYard(prisma);
    container = await placeContainer(prisma, {
      block: yard.B,
      row: 1,
      bay: 1,
      tier: 1,
      companyId: company.id,
    });
    admin = await loginAs(app, USER_EMAILS.ADMIN);
  });

  afterAll(close);

  async function placeHold(containerNumber = container.number) {
    return admin.post(HOLDS_PATH).send({ containerNumber, reason: REASON });
  }

  test('places a hold, notifies the owner, audits it and updates the yard map', async () => {
    const events = recordEvents(eventBus, [NOTIFICATION_NEW, CONTAINER_CHANGED, YARD_CHANGED]);
    const response = await placeHold(container.number.toLowerCase());
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      reason: REASON,
      isActive: true,
      containerNumber: container.number,
      positionCode: 'B-01-01-1',
      owner: { code: 'TST' },
      placedBy: { id: users.ADMIN.id, name: 'Test admin' },
      releasedAt: null,
    });
    const notification = await prisma.notification.findFirstOrThrow();
    expect(notification).toMatchObject({ type: 'CUSTOMS_HOLD_PLACED', companyId: company.id });
    expect(notification.message).toContain(REASON);
    expect(await prisma.auditLog.count({ where: { action: 'PLACE_HOLD' } })).toBe(1);
    expect(events.map((event) => event.eventName)).toEqual([
      NOTIFICATION_NEW,
      CONTAINER_CHANGED,
      YARD_CHANGED,
    ]);
    expect(events[2].payload.changes).toEqual([
      { positionCode: 'B-01-01-1', containerNumber: container.number, action: 'HOLD_PLACED' },
    ]);
  });

  test('places a hold on an expected container without a yard event', async () => {
    const events = recordEvents(eventBus, [YARD_CHANGED]);
    const expected = await createContainer(prisma, { companyId: company.id, state: 'EXPECTED' });
    const response = await placeHold(expected.number);
    expect(response.body.data).toMatchObject({ containerState: 'EXPECTED', positionCode: null });
    expect(events).toEqual([]);
  });

  test('allows only one active hold per container', async () => {
    await placeHold();
    const response = await placeHold();
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('HOLD_ALREADY_ACTIVE');
  });

  test('refuses a departed container and answers 404 for an unknown one', async () => {
    const departed = await createContainer(prisma, { companyId: company.id, state: 'DEPARTED' });
    expect((await placeHold(departed.number)).body.error.code).toBe('CONTAINER_NOT_HOLDABLE');
    expect((await placeHold(generateContainerNumber('ZZZU', 1))).status).toBe(404);
  });

  test('rejects a missing reason and a bad container number', async () => {
    expect((await admin.post(HOLDS_PATH).send({ containerNumber: container.number })).status).toBe(
      422,
    );
    expect(
      (await admin.post(HOLDS_PATH).send({ containerNumber: 'CSQU3054384', reason: REASON }))
        .status,
    ).toBe(422);
  });

  test('releases an active hold once, notifies and audits', async () => {
    const placed = await placeHold();
    const response = await admin.post(`${HOLDS_PATH}/${placed.body.data.id}/release`);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      isActive: false,
      releasedBy: { id: users.ADMIN.id, name: 'Test admin' },
    });
    expect(await prisma.notification.count({ where: { type: 'CUSTOMS_HOLD_RELEASED' } })).toBe(1);
    expect(await prisma.notification.count({ where: { type: 'READY_FOR_PICKUP' } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: 'RELEASE_HOLD' } })).toBe(1);
    const again = await admin.post(`${HOLDS_PATH}/${placed.body.data.id}/release`);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('HOLD_NOT_ACTIVE');
    expect((await admin.post(`${HOLDS_PATH}/999999/release`)).status).toBe(404);
  });

  test('also notifies READY_FOR_PICKUP when the container has an active pickup', async () => {
    const slot = await createTimeSlot(prisma, { date: '2026-12-01', startHour: 9 });
    await createBookedPreAdvice(prisma, {
      companyId: company.id,
      timeSlotId: slot.id,
      type: 'PICKUP',
      containerNumber: container.number,
      truckPlate: 'HH-CU 1',
      driverName: 'Driver',
      pin: '123456',
    });
    const placed = await placeHold();
    await admin.post(`${HOLDS_PATH}/${placed.body.data.id}/release`);
    const ready = await prisma.notification.findFirstOrThrow({
      where: { type: 'READY_FOR_PICKUP' },
    });
    expect(ready.message).toMatch(/is ready for pickup\.$/);
  });

  test('lists holds and filters active and released ones', async () => {
    const other = await createContainer(prisma, { companyId: company.id, state: 'EXPECTED' });
    const first = await placeHold();
    await placeHold(other.number);
    await admin.post(`${HOLDS_PATH}/${first.body.data.id}/release`);
    expect((await admin.get(HOLDS_PATH)).body.total).toBe(2);
    const active = await admin.get(`${HOLDS_PATH}?isActive=true`);
    expect(active.body.data.map((hold) => hold.containerNumber)).toEqual([other.number]);
    const released = await admin.get(
      `${HOLDS_PATH}?isActive=false&containerNumber=${container.number}`,
    );
    expect(released.body.total).toBe(1);
  });

  test('makes the container show the hold in its detail', async () => {
    await placeHold();
    const planner = await loginAs(app, USER_EMAILS.PLANNER);
    const detail = await planner.get(`/api/v1/containers/${container.number}`);
    expect(detail.body.data.hasHold).toBe(true);
  });
});
