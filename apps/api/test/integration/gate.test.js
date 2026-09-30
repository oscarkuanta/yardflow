import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import { generateContainerNumber } from '@yardflow/shared';
import {
  GATE_EVENT,
  NOTIFICATION_NEW,
  YARD_CHANGED,
  createEventBus,
} from '../../src/lib/event-bus.js';
import {
  USER_EMAILS,
  createBookedPreAdvice,
  createCompany,
  createHold,
  createInvoice,
  createSmallYard,
  createTariffs,
  createTimeSlot,
  createUsersForAllRoles,
  loginAs,
  placeContainer,
  recordEvents,
  resetDatabase,
} from '../helpers/fixtures.js';
import { createTestContext } from '../helpers/test-app.js';

const GATE_PATH = '/api/v1/gate';
const TEN_TWENTY_BERLIN = new Date('2026-09-30T08:20:00Z');
const DELIVERY_PIN = '175824';
const PICKUP_PIN = '482913';

describe('gate', () => {
  const eventBus = createEventBus();
  const clock = { now: TEN_TWENTY_BERLIN };
  const { app, prisma, close } = createTestContext({ clock: () => clock.now, eventBus });
  let gate;
  let users;
  let company;
  let yard;
  let slot;
  let delivery;
  let pickup;
  let pickupContainer;
  let plateSerial = 0;

  function uniquePlate() {
    plateSerial += 1;
    return `HH-GT ${plateSerial}`;
  }

  beforeEach(async () => {
    clock.now = TEN_TWENTY_BERLIN;
    await resetDatabase(prisma);
    ({ users, company } = await createUsersForAllRoles(prisma));
    yard = await createSmallYard(prisma);
    await createTariffs(prisma);
    slot = await createTimeSlot(prisma, { date: '2026-09-30', startHour: 10 });
    delivery = await createBookedPreAdvice(prisma, {
      companyId: company.id,
      timeSlotId: slot.id,
      type: 'DELIVERY',
      containerNumber: generateContainerNumber('GTEU', 1),
      truckPlate: uniquePlate(),
      driverName: 'Mats Olsen',
      pin: DELIVERY_PIN,
    });
    pickupContainer = await placeContainer(prisma, {
      block: yard.B,
      row: 1,
      bay: 2,
      tier: 1,
      companyId: company.id,
      gateInAt: new Date('2026-09-28T08:00:00Z'),
    });
    pickup = await createBookedPreAdvice(prisma, {
      companyId: company.id,
      timeSlotId: slot.id,
      type: 'PICKUP',
      containerNumber: pickupContainer.number,
      truckPlate: uniquePlate(),
      driverName: 'Jan Becker',
      pin: PICKUP_PIN,
    });
    await createInvoice(prisma, {
      containerId: pickupContainer.id,
      periodFrom: pickupContainer.gateInAt,
      periodTo: new Date('2026-09-30T09:00:00Z'),
    });
    gate = await loginAs(app, USER_EMAILS.GATE_OPERATOR);
  });

  afterAll(close);

  function verify(agent, preAdvice, pin, direction) {
    return agent
      .post(`${GATE_PATH}/verify-truck`)
      .send({ truckPlate: preAdvice.truckPlate.toLowerCase(), pin, direction });
  }

  function gateInBody(overrides = {}) {
    return {
      preAdviceId: delivery.id,
      containerNumber: delivery.containerNumber,
      lane: 1,
      damages: [{ side: 'LEFT', code: 'DENT', note: 'Small dent near the door' }],
      to: 'B-02-03',
      ...overrides,
    };
  }

  function gateOutBody(overrides = {}) {
    return {
      preAdviceId: pickup.id,
      truckPlate: pickup.truckPlate,
      driverName: 'jan becker',
      lane: 2,
      ...overrides,
    };
  }

  describe('POST /gate/verify-truck (spec 6.8 step 1)', () => {
    test('finds the pre-advice by plate and PIN inside the slot window', async () => {
      const response = await verify(gate, delivery, DELIVERY_PIN, 'IN');
      expect(response.status).toBe(200);
      expect(response.body.data.preAdvice).toMatchObject({
        id: delivery.id,
        type: 'DELIVERY',
        truckPlate: delivery.truckPlate,
      });
      expect(response.body.data.container).toBeNull();
    });

    test('shows the pickup container with its position', async () => {
      const response = await verify(gate, pickup, PICKUP_PIN, 'OUT');
      expect(response.body.data.container).toMatchObject({
        number: pickupContainer.number,
        positionCode: 'B-01-02-1',
        hasHold: false,
      });
    });

    test('answers 404 for the wrong direction, an unknown plate or outside the window', async () => {
      expect((await verify(gate, delivery, DELIVERY_PIN, 'OUT')).status).toBe(404);
      const unknown = await gate
        .post(`${GATE_PATH}/verify-truck`)
        .send({ truckPlate: 'ZZ-ZZ 99', pin: DELIVERY_PIN, direction: 'IN' });
      expect(unknown.status).toBe(404);
      clock.now = new Date('2026-09-30T07:20:00Z');
      expect((await verify(gate, delivery, DELIVERY_PIN, 'IN')).status).toBe(404);
    });

    test('counts wrong PINs and locks the plate for 15 minutes after five', async () => {
      const first = await verify(gate, delivery, '000000', 'IN');
      expect(first.status).toBe(409);
      expect(first.body.error).toMatchObject({
        code: 'PIN_MISMATCH',
        message: 'PIN does not match. 4 attempts left',
      });
      for (let attempt = 2; attempt <= 4; attempt += 1) {
        await verify(gate, delivery, '000000', 'IN');
      }
      const fifth = await verify(gate, delivery, '000000', 'IN');
      expect(fifth.status).toBe(429);
      expect(fifth.body.error.code).toBe('PLATE_LOCKED');
      expect(fifth.body.error.message).toContain('Try again after 10:35');
      expect((await verify(gate, delivery, DELIVERY_PIN, 'IN')).status).toBe(429);
      expect(await prisma.auditLog.count({ where: { action: 'GATE_PIN_FAILED' } })).toBe(5);
      clock.now = new Date('2026-09-30T08:36:00Z');
      expect((await verify(gate, delivery, DELIVERY_PIN, 'IN')).status).toBe(200);
    });
  });

  describe('POST /gate/in (spec 6.8)', () => {
    test('refuses a gate-in before the truck and PIN are verified', async () => {
      const response = await gate.post(`${GATE_PATH}/in`).send(gateInBody());
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('TRUCK_NOT_VERIFIED');
    });

    test('puts the container into the yard and records the whole gate-in', async () => {
      const events = recordEvents(eventBus, [YARD_CHANGED, GATE_EVENT, NOTIFICATION_NEW]);
      await verify(gate, delivery, DELIVERY_PIN, 'IN');
      const response = await gate.post(`${GATE_PATH}/in`).send(gateInBody());
      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        containerNumber: delivery.containerNumber,
        positionCode: 'B-02-03-1',
      });
      expect(response.body.data.eirUrl).toBe(
        `/api/v1/gate/transactions/${response.body.data.gateTransactionId}/eir.pdf`,
      );
      const container = await prisma.container.findUniqueOrThrow({
        where: { number: delivery.containerNumber },
        include: { position: true, movements: true },
      });
      expect(container).toMatchObject({
        state: 'IN_YARD',
        gateInAt: TEN_TWENTY_BERLIN,
        size: 'FT40',
        isHighCube: true,
        grossWeightKg: 21000,
        ownerCompanyId: company.id,
      });
      expect(container.movements).toEqual([
        expect.objectContaining({ type: 'GATE_IN', toPosition: 'B-02-03-1' }),
      ]);
      const transaction = await prisma.gateTransaction.findUniqueOrThrow({
        where: { id: response.body.data.gateTransactionId },
        include: { damages: true },
      });
      expect(transaction).toMatchObject({
        direction: 'IN',
        lane: 1,
        noDamage: false,
        operatorId: users.GATE_OPERATOR.id,
      });
      expect(transaction.damages).toEqual([
        expect.objectContaining({ side: 'LEFT', code: 'DENT', note: 'Small dent near the door' }),
      ]);
      expect(
        (await prisma.preAdvice.findUniqueOrThrow({ where: { id: delivery.id } })).status,
      ).toBe('USED');
      expect(await prisma.notification.count({ where: { type: 'CONTAINER_IN_YARD' } })).toBe(1);
      expect(await prisma.auditLog.count({ where: { action: 'GATE_IN' } })).toBe(1);
      expect(events.find((event) => event.eventName === GATE_EVENT).payload).toMatchObject({
        kind: 'IN',
        lane: 1,
        plate: delivery.truckPlate,
        message: 'Gate-in complete · B-02-03-1',
      });
      const again = await gate.post(`${GATE_PATH}/in`).send(gateInBody());
      expect(again.body.error.code).toBe('TRUCK_NOT_VERIFIED');
    });

    test('accepts "No damage" instead of damage reports', async () => {
      await verify(gate, delivery, DELIVERY_PIN, 'IN');
      const response = await gate
        .post(`${GATE_PATH}/in`)
        .send(gateInBody({ damages: [], noDamage: true }));
      expect(response.status).toBe(201);
    });

    test.each([
      ['neither damage nor "No damage"', { damages: [], noDamage: false }],
      ['both damage and "No damage"', { noDamage: true }],
      ['an unknown lane', { lane: 7 }],
    ])('rejects %s with 422', async (_label, changes) => {
      await verify(gate, delivery, DELIVERY_PIN, 'IN');
      expect((await gate.post(`${GATE_PATH}/in`).send(gateInBody(changes))).status).toBe(422);
    });

    test('refuses a container number that does not match the pre-advice', async () => {
      await verify(gate, delivery, DELIVERY_PIN, 'IN');
      const response = await gate
        .post(`${GATE_PATH}/in`)
        .send(gateInBody({ containerNumber: generateContainerNumber('GTEU', 2) }));
      expect(response.body.error.code).toBe('CONTAINER_MISMATCH');
    });

    test('keeps the pre-advice active when the chosen slot breaks a stacking rule', async () => {
      await verify(gate, delivery, DELIVERY_PIN, 'IN');
      const response = await gate.post(`${GATE_PATH}/in`).send(gateInBody({ to: 'A-01-01' }));
      expect(response.body.error.code).toBe('STACKING_RULE_BROKEN');
      expect(
        (await prisma.preAdvice.findUniqueOrThrow({ where: { id: delivery.id } })).status,
      ).toBe('ACTIVE');
      expect(await prisma.gateTransaction.count()).toBe(0);
    });

    test('refuses a truck whose window closed after it was verified', async () => {
      clock.now = new Date('2026-09-30T09:05:00Z');
      await verify(gate, delivery, DELIVERY_PIN, 'IN');
      clock.now = new Date('2026-09-30T09:31:00Z');
      const response = await gate.post(`${GATE_PATH}/in`).send(gateInBody());
      expect(response.body.error.code).toBe('OUTSIDE_TIME_SLOT');
    });
  });

  describe('POST /gate/out/check (spec 6.9)', () => {
    test('passes all four checks and allows completion', async () => {
      await verify(gate, pickup, PICKUP_PIN, 'OUT');
      const response = await gate.post(`${GATE_PATH}/out/check`).send(gateOutBody());
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        passed: true,
        canComplete: true,
        relocations: [],
      });
      expect(response.body.data.checks.map((item) => [item.key, item.passed])).toEqual([
        ['PRE_ADVICE', true],
        ['TRUCK_DRIVER', true],
        ['CUSTOMS', true],
        ['INVOICE', true],
      ]);
    });

    test('denies a wrong driver, audits it and emits a DENIED gate event', async () => {
      const events = recordEvents(eventBus, [GATE_EVENT]);
      await verify(gate, pickup, PICKUP_PIN, 'OUT');
      const response = await gate
        .post(`${GATE_PATH}/out/check`)
        .send(gateOutBody({ driverName: 'Somebody Else' }));
      expect(response.body.data.passed).toBe(false);
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'GATE_OUT_DENIED' },
      });
      expect(audit.after.failedChecks).toEqual([
        {
          key: 'TRUCK_DRIVER',
          passed: false,
          message: 'Driver name does not match the pre-advice',
        },
      ]);
      expect(events.at(-1).payload).toMatchObject({
        kind: 'DENIED',
        message: 'Driver name does not match the pre-advice',
        lane: 2,
      });
    });

    test('fails the customs check while a hold is active', async () => {
      await createHold(prisma, { containerId: pickupContainer.id, placedById: users.ADMIN.id });
      await verify(gate, pickup, PICKUP_PIN, 'OUT');
      const response = await gate.post(`${GATE_PATH}/out/check`).send(gateOutBody());
      const failed = response.body.data.checks.filter((item) => !item.passed);
      expect(failed.map((item) => item.key)).toEqual(['CUSTOMS']);
    });

    test('fails the invoice check while the invoice is unpaid', async () => {
      await prisma.storageInvoice.updateMany({ data: { status: 'UNPAID', paidAt: null } });
      await verify(gate, pickup, PICKUP_PIN, 'OUT');
      const response = await gate.post(`${GATE_PATH}/out/check`).send(gateOutBody());
      expect(response.body.data.checks.find((item) => item.key === 'INVOICE').passed).toBe(false);
    });

    test('bills the extra days of a truck that arrives after the paid period', async () => {
      await prisma.storageInvoice.updateMany({
        data: { periodTo: new Date('2026-09-28T09:00:00Z') },
      });
      await prisma.container.update({
        where: { id: pickupContainer.id },
        data: { gateInAt: new Date('2026-09-22T08:00:00Z') },
      });
      await verify(gate, pickup, PICKUP_PIN, 'OUT');
      const response = await gate.post(`${GATE_PATH}/out/check`).send(gateOutBody());
      expect(response.body.data.checks.find((item) => item.key === 'INVOICE')).toMatchObject({
        passed: false,
      });
      expect(response.body.data.invoice).toMatchObject({
        status: 'UNPAID',
        chargeableDays: 2,
        amountCents: 3000,
        periodTo: '2026-09-30T09:30:00.000Z',
      });
      expect(await prisma.storageInvoice.count({ where: { status: 'PAID' } })).toBe(1);
    });

    test('voids an unpaid outdated invoice and issues a new one for the whole stay', async () => {
      await prisma.storageInvoice.updateMany({
        data: { status: 'UNPAID', paidAt: null, periodTo: new Date('2026-09-29T09:00:00Z') },
      });
      await verify(gate, pickup, PICKUP_PIN, 'OUT');
      const response = await gate.post(`${GATE_PATH}/out/check`).send(gateOutBody());
      expect(await prisma.storageInvoice.count({ where: { status: 'VOID' } })).toBe(1);
      expect(response.body.data.invoice).toMatchObject({ amountCents: 0, status: 'PAID' });
      expect(response.body.data.passed).toBe(true);
    });

    test('creates relocation work orders when the container is blocked', async () => {
      const events = recordEvents(eventBus, [GATE_EVENT]);
      for (const tier of [2, 3]) {
        await placeContainer(prisma, {
          block: yard.B,
          row: 1,
          bay: 2,
          tier,
          companyId: company.id,
        });
      }
      await verify(gate, pickup, PICKUP_PIN, 'OUT');
      const response = await gate.post(`${GATE_PATH}/out/check`).send(gateOutBody());
      expect(response.body.data).toMatchObject({ passed: true, canComplete: false });
      expect(response.body.data.relocations).toHaveLength(2);
      expect(events.at(-1).payload).toMatchObject({
        kind: 'WAITING',
        message: 'Waiting for 2 relocations',
      });
      const blocked = await gate.post(`${GATE_PATH}/out`).send(gateOutBody());
      expect(blocked.body.error.code).toBe('RELOCATION_PENDING');
      const planner = await loginAs(app, USER_EMAILS.PLANNER);
      for (const order of response.body.data.relocations) {
        await planner.post(`/api/v1/work-orders/${order.id}/complete`);
      }
      const recheck = await gate.post(`${GATE_PATH}/out/check`).send(gateOutBody());
      expect(recheck.body.data.canComplete).toBe(true);
      expect((await gate.post(`${GATE_PATH}/out`).send(gateOutBody())).status).toBe(201);
    });
  });

  describe('POST /gate/out (spec 6.9)', () => {
    test('completes the gate-out and records everything', async () => {
      const events = recordEvents(eventBus, [YARD_CHANGED, GATE_EVENT]);
      await verify(gate, pickup, PICKUP_PIN, 'OUT');
      const response = await gate.post(`${GATE_PATH}/out`).send(gateOutBody());
      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        containerNumber: pickupContainer.number,
        fromPosition: 'B-01-02-1',
      });
      const container = await prisma.container.findUniqueOrThrow({
        where: { id: pickupContainer.id },
        include: { position: true, movements: true },
      });
      expect(container).toMatchObject({
        state: 'DEPARTED',
        departedAt: TEN_TWENTY_BERLIN,
        position: null,
      });
      expect(container.movements).toEqual([
        expect.objectContaining({ type: 'GATE_OUT', fromPosition: 'B-01-02-1' }),
      ]);
      expect((await prisma.preAdvice.findUniqueOrThrow({ where: { id: pickup.id } })).status).toBe(
        'USED',
      );
      expect(await prisma.notification.count({ where: { type: 'GATE_OUT_DONE' } })).toBe(1);
      expect(events.map((event) => event.eventName)).toEqual([YARD_CHANGED, GATE_EVENT]);
      expect(events[1].payload.kind).toBe('OUT');
    });

    test('refuses completion when a check fails', async () => {
      await createHold(prisma, { containerId: pickupContainer.id, placedById: users.ADMIN.id });
      await verify(gate, pickup, PICKUP_PIN, 'OUT');
      const response = await gate.post(`${GATE_PATH}/out`).send(gateOutBody());
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('GATE_OUT_DENIED');
      expect(response.body.error.details.map((item) => item.key)).toEqual(['CUSTOMS']);
    });
  });

  describe('transactions and EIR ticket', () => {
    async function gateInOnce() {
      await verify(gate, delivery, DELIVERY_PIN, 'IN');
      const response = await gate.post(`${GATE_PATH}/in`).send(gateInBody());
      return response.body.data.gateTransactionId;
    }

    test('lists gate transactions for staff with damage count and EIR link', async () => {
      const id = await gateInOnce();
      const planner = await loginAs(app, USER_EMAILS.PLANNER);
      const response = await planner.get(`${GATE_PATH}/transactions?direction=IN&date=2026-09-30`);
      expect(response.body.data).toEqual([
        expect.objectContaining({ id, direction: 'IN', damageCount: 1, noDamage: false }),
      ]);
      expect((await planner.get(`${GATE_PATH}/transactions?date=2026-09-29`)).body.total).toBe(0);
    });

    test('serves the EIR as a PDF to staff and to the owner company only', async () => {
      const id = await gateInOnce();
      const pdf = await gate
        .get(`${GATE_PATH}/transactions/${id}/eir.pdf`)
        .buffer(true)
        .parse((response, callback) => {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        });
      expect(pdf.status).toBe(200);
      expect(pdf.headers['content-type']).toBe('application/pdf');
      expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
      const customer = await loginAs(app, USER_EMAILS.CUSTOMER);
      expect((await customer.get(`${GATE_PATH}/transactions/${id}/eir.pdf`)).status).toBe(200);
      const other = await createCompany(prisma, { code: 'OTH', name: 'Other' });
      await prisma.preAdvice.update({ where: { id: delivery.id }, data: { companyId: other.id } });
      expect((await customer.get(`${GATE_PATH}/transactions/${id}/eir.pdf`)).status).toBe(404);
    });
  });

  test('runs the whole pickup: booking, next-day gate-out with PIN, EIR', async () => {
    const tomorrowSlot = await createTimeSlot(prisma, { date: '2026-10-01', startHour: 9 });
    const truckPlate = uniquePlate();
    const customer = await loginAs(app, USER_EMAILS.CUSTOMER);
    await prisma.preAdvice.update({ where: { id: pickup.id }, data: { status: 'CANCELLED' } });
    const booking = await customer.post('/api/v1/pre-advices').send({
      type: 'PICKUP',
      timeSlotId: tomorrowSlot.id,
      containerNumber: pickupContainer.number,
      truckPlate,
      driverName: 'Nina Weber',
    });
    expect(booking.status).toBe(201);
    clock.now = new Date('2026-10-01T07:10:00Z');
    const verifyResponse = await gate
      .post(`${GATE_PATH}/verify-truck`)
      .send({ truckPlate, pin: booking.body.data.pin, direction: 'OUT' });
    expect(verifyResponse.status).toBe(200);
    const body = {
      preAdviceId: booking.body.data.id,
      truckPlate,
      driverName: 'NINA WEBER',
      lane: 1,
    };
    const check = await gate.post(`${GATE_PATH}/out/check`).send(body);
    expect(check.body.data.passed).toBe(true);
    const out = await gate.post(`${GATE_PATH}/out`).send(body);
    expect(out.status).toBe(201);
    expect((await customer.get(out.body.data.eirUrl)).status).toBe(200);
  });
});
