import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import { generateContainerNumber } from '@yardflow/shared';
import bcrypt from 'bcrypt';
import { createAuditService } from '../../src/modules/audit/audit.service.js';
import { createRelocationWorkOrders } from '../../src/modules/workorders/workorders.service.js';
import {
  USER_EMAILS,
  createBookedPreAdvice,
  createCompany,
  createContainer,
  createSmallYard,
  createTariffs,
  createTimeSlot,
  createUsersForAllRoles,
  loginAs,
  placeContainer,
  resetDatabase,
} from '../helpers/fixtures.js';
import { createTestContext } from '../helpers/test-app.js';

const PRE_ADVICES_PATH = '/api/v1/pre-advices';
const NOW = new Date('2026-09-30T08:20:00Z');
const EIGHT_DAYS_AGO = new Date('2026-09-22T08:20:00Z');
const TOMORROW = '2026-10-01';

describe('pre-advices (spec 6.7)', () => {
  const { app, prisma, close } = createTestContext({ clock: () => NOW });
  let customer;
  let admin;
  let users;
  let company;
  let otherCompany;
  let yard;
  let tomorrowSlot;
  let ownContainer;

  beforeEach(async () => {
    await resetDatabase(prisma);
    ({ users, company } = await createUsersForAllRoles(prisma));
    otherCompany = await createCompany(prisma, { code: 'OTH', name: 'Other Freight' });
    yard = await createSmallYard(prisma);
    await createTariffs(prisma);
    tomorrowSlot = await createTimeSlot(prisma, { date: TOMORROW, startHour: 9, capacity: 2 });
    ownContainer = await placeContainer(prisma, {
      block: yard.B,
      row: 1,
      bay: 1,
      tier: 1,
      companyId: company.id,
      gateInAt: EIGHT_DAYS_AGO,
    });
    customer = await loginAs(app, USER_EMAILS.CUSTOMER);
    admin = await loginAs(app, USER_EMAILS.ADMIN);
  });

  afterAll(close);

  function pickupFor(containerNumber, overrides = {}) {
    return {
      type: 'PICKUP',
      timeSlotId: tomorrowSlot.id,
      containerNumber,
      truckPlate: 'hh-yf   482',
      driverName: 'Jan Becker',
      ...overrides,
    };
  }

  function deliveryFor(containerNumber, overrides = {}) {
    return {
      type: 'DELIVERY',
      timeSlotId: tomorrowSlot.id,
      containerNumber,
      truckPlate: 'HH-YF 175',
      driverName: 'Mats Olsen',
      size: 'FT40',
      isHighCube: true,
      loadStatus: 'FULL',
      isDangerous: false,
      imoClass: null,
      grossWeightKg: 21000,
      ...overrides,
    };
  }

  describe('POST /pre-advices', () => {
    test('books a pickup, returns the PIN once and stores only its hash', async () => {
      const response = await customer.post(PRE_ADVICES_PATH).send(pickupFor(ownContainer.number));
      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        reference: 'PA-20260930-0001',
        type: 'PICKUP',
        status: 'ACTIVE',
        truckPlate: 'HH-YF 482',
        timeSlot: { date: TOMORROW, startHour: 9, startsAt: '2026-10-01T07:00:00.000Z' },
        gateWindow: {
          opensAt: '2026-10-01T06:30:00.000Z',
          closesAt: '2026-10-01T08:30:00.000Z',
        },
      });
      const { pin } = response.body.data;
      expect(pin).toMatch(/^\d{6}$/);
      const stored = await prisma.preAdvice.findUniqueOrThrow({
        where: { id: response.body.data.id },
      });
      expect(stored.pinHash).not.toContain(pin);
      expect(await bcrypt.compare(pin, stored.pinHash)).toBe(true);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { entity: 'PreAdvice' } });
      expect(JSON.stringify(audit)).not.toContain(pin);
      const list = await customer.get(PRE_ADVICES_PATH);
      expect(list.body.data[0]).not.toHaveProperty('pin');
    });

    test('issues a storage invoice from gate-in to the end of the booked slot and notifies', async () => {
      const response = await customer.post(PRE_ADVICES_PATH).send(pickupFor(ownContainer.number));
      expect(response.body.data.invoice).toMatchObject({
        number: 'INV-2026-00001',
        chargeableDays: 4,
        amountCents: 6000,
        status: 'UNPAID',
        periodTo: '2026-10-01T08:00:00.000Z',
      });
      const notification = await prisma.notification.findFirstOrThrow();
      expect(notification).toMatchObject({ type: 'INVOICE_ISSUED', companyId: company.id });
      expect(notification.message).toContain('€60.00');
    });

    test('marks a zero-amount invoice as paid right away and sends no notification', async () => {
      await prisma.container.update({ where: { id: ownContainer.id }, data: { gateInAt: NOW } });
      const response = await customer.post(PRE_ADVICES_PATH).send(pickupFor(ownContainer.number));
      expect(response.body.data.invoice).toMatchObject({ amountCents: 0, status: 'PAID' });
      expect(await prisma.notification.count()).toBe(0);
    });

    test('numbers references per day', async () => {
      const second = await placeContainer(prisma, {
        block: yard.B,
        row: 1,
        bay: 2,
        tier: 1,
        companyId: company.id,
      });
      await customer.post(PRE_ADVICES_PATH).send(pickupFor(ownContainer.number));
      const response = await customer.post(PRE_ADVICES_PATH).send(pickupFor(second.number));
      expect(response.body.data.reference).toBe('PA-20260930-0002');
    });

    test('answers 404 for a pickup of another company container', async () => {
      const other = await placeContainer(prisma, {
        block: yard.B,
        row: 1,
        bay: 3,
        tier: 1,
        companyId: otherCompany.id,
      });
      const response = await customer.post(PRE_ADVICES_PATH).send(pickupFor(other.number));
      expect(response.status).toBe(404);
    });

    test('refuses a pickup of a container that is not in the yard yet', async () => {
      const expected = await createContainer(prisma, { companyId: company.id, state: 'EXPECTED' });
      const response = await customer.post(PRE_ADVICES_PATH).send(pickupFor(expected.number));
      expect(response.body.error.code).toBe('CONTAINER_NOT_IN_YARD');
    });

    test('allows only one active pre-advice per container', async () => {
      await customer.post(PRE_ADVICES_PATH).send(pickupFor(ownContainer.number));
      const response = await customer.post(PRE_ADVICES_PATH).send(pickupFor(ownContainer.number));
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('ACTIVE_PRE_ADVICE_EXISTS');
    });

    test('refuses a full slot but ignores cancelled bookings', async () => {
      const numbers = [1, 2, 3].map((serial) => generateContainerNumber('DLVU', serial));
      await createBookedPreAdvice(prisma, {
        companyId: company.id,
        timeSlotId: tomorrowSlot.id,
        type: 'DELIVERY',
        containerNumber: numbers[0],
        truckPlate: 'HH-AA 1',
        driverName: 'A',
        pin: '111111',
        status: 'CANCELLED',
      });
      expect((await customer.post(PRE_ADVICES_PATH).send(deliveryFor(numbers[1]))).status).toBe(
        201,
      );
      expect((await customer.post(PRE_ADVICES_PATH).send(deliveryFor(numbers[2]))).status).toBe(
        201,
      );
      const full = await customer.post(PRE_ADVICES_PATH).send(pickupFor(ownContainer.number));
      expect(full.status).toBe(409);
      expect(full.body.error).toMatchObject({
        code: 'SLOT_FULL',
        message: 'This time slot is full, please choose another',
      });
    });

    test('refuses a slot that starts in less than 60 minutes', async () => {
      const soon = await createTimeSlot(prisma, { date: '2026-09-30', startHour: 11 });
      const response = await customer
        .post(PRE_ADVICES_PATH)
        .send(pickupFor(ownContainer.number, { timeSlotId: soon.id }));
      expect(response.body.error.code).toBe('SLOT_TOO_SOON');
    });

    test('books a delivery and records the container as EXPECTED', async () => {
      const number = generateContainerNumber('DLVU', 7);
      const response = await customer.post(PRE_ADVICES_PATH).send(deliveryFor(number));
      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        size: 'FT40',
        grossWeightKg: 21000,
        invoice: null,
      });
      expect(await prisma.container.findUniqueOrThrow({ where: { number } })).toMatchObject({
        state: 'EXPECTED',
        ownerCompanyId: company.id,
        isHighCube: true,
      });
    });

    test.each([
      ['a missing weight', { grossWeightKg: undefined }, 'body.grossWeightKg'],
      ['DG without IMO class', { isDangerous: true }, 'body.imoClass'],
      ['a bad plate', { truckPlate: 'HH/YF#1' }, 'body.truckPlate'],
      ['an unknown type', { type: 'TRANSFER' }, 'body.type'],
    ])('rejects a delivery with %s', async (_label, changes, field) => {
      const response = await customer
        .post(PRE_ADVICES_PATH)
        .send(deliveryFor(generateContainerNumber('DLVU', 8), changes));
      expect(response.status).toBe(422);
      expect(response.body.error.details.map((detail) => detail.field)).toContain(field);
    });

    test('refuses a delivery of a container in the yard or expected by another company', async () => {
      const inYard = await customer.post(PRE_ADVICES_PATH).send(deliveryFor(ownContainer.number));
      expect(inYard.body.error.code).toBe('CONTAINER_ALREADY_IN_YARD');
      const foreign = await createContainer(prisma, {
        companyId: otherCompany.id,
        state: 'EXPECTED',
      });
      const response = await customer.post(PRE_ADVICES_PATH).send(deliveryFor(foreign.number));
      expect(response.body.error.code).toBe('CONTAINER_NOT_AVAILABLE');
    });
  });

  describe('GET /pre-advices', () => {
    test('shows a customer only its own company and admin everything, with filters', async () => {
      const otherCustomer = await prisma.user.create({
        data: {
          email: 'other@test.example',
          name: 'Other',
          passwordHash: (await prisma.user.findUniqueOrThrow({ where: { id: users.CUSTOMER.id } }))
            .passwordHash,
          role: 'CUSTOMER',
          companyId: otherCompany.id,
        },
      });
      await createBookedPreAdvice(prisma, {
        companyId: otherCustomer.companyId,
        timeSlotId: tomorrowSlot.id,
        type: 'DELIVERY',
        containerNumber: generateContainerNumber('DLVU', 9),
        truckPlate: 'HH-OT 1',
        driverName: 'Other Driver',
        pin: '222222',
      });
      const own = await customer.post(PRE_ADVICES_PATH).send(pickupFor(ownContainer.number));
      expect((await customer.get(PRE_ADVICES_PATH)).body.total).toBe(1);
      expect((await admin.get(PRE_ADVICES_PATH)).body.total).toBe(2);
      expect((await admin.get(`${PRE_ADVICES_PATH}?type=DELIVERY`)).body.total).toBe(1);
      expect((await admin.get(`${PRE_ADVICES_PATH}?date=${TOMORROW}`)).body.total).toBe(2);
      const bySearch = await admin.get(`${PRE_ADVICES_PATH}?search=${own.body.data.reference}`);
      expect(bySearch.body.data.map((item) => item.id)).toEqual([own.body.data.id]);
    });
  });

  describe('regenerate PIN and cancel', () => {
    test('a new PIN replaces the old one', async () => {
      const created = await customer.post(PRE_ADVICES_PATH).send(pickupFor(ownContainer.number));
      const response = await customer.post(
        `${PRE_ADVICES_PATH}/${created.body.data.id}/regenerate-pin`,
      );
      expect(response.status).toBe(200);
      const stored = await prisma.preAdvice.findUniqueOrThrow({
        where: { id: created.body.data.id },
      });
      expect(await bcrypt.compare(response.body.data.pin, stored.pinHash)).toBe(true);
      expect(await bcrypt.compare(created.body.data.pin, stored.pinHash)).toBe(
        created.body.data.pin === response.body.data.pin,
      );
    });

    test('answers 404 for another company pre-advice', async () => {
      const foreign = await createBookedPreAdvice(prisma, {
        companyId: otherCompany.id,
        timeSlotId: tomorrowSlot.id,
        type: 'DELIVERY',
        containerNumber: generateContainerNumber('DLVU', 10),
        truckPlate: 'HH-OT 2',
        driverName: 'Other Driver',
        pin: '333333',
      });
      expect((await customer.post(`${PRE_ADVICES_PATH}/${foreign.id}/regenerate-pin`)).status).toBe(
        404,
      );
      expect((await customer.post(`${PRE_ADVICES_PATH}/${foreign.id}/cancel`)).status).toBe(404);
    });

    test('cancelling a pickup cancels its open relocation work orders', async () => {
      for (const tier of [2, 3]) {
        await placeContainer(prisma, {
          block: yard.B,
          row: 1,
          bay: 1,
          tier,
          companyId: company.id,
        });
      }
      const created = await customer.post(PRE_ADVICES_PATH).send(pickupFor(ownContainer.number));
      await prisma.$transaction((transaction) =>
        createRelocationWorkOrders(transaction, {
          targetContainerId: ownContainer.id,
          reason: 'Test',
          actor: { id: users.ADMIN.id },
          auditService: createAuditService({ prisma }),
        }),
      );
      const response = await customer.post(`${PRE_ADVICES_PATH}/${created.body.data.id}/cancel`);
      expect(response.body.data.status).toBe('CANCELLED');
      expect(await prisma.workOrder.count({ where: { status: 'CANCELLED' } })).toBe(2);
      const again = await admin.post(`${PRE_ADVICES_PATH}/${created.body.data.id}/cancel`);
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('PRE_ADVICE_NOT_ACTIVE');
    });

    test('an admin can cancel any pre-advice', async () => {
      const created = await customer.post(PRE_ADVICES_PATH).send(pickupFor(ownContainer.number));
      const response = await admin.post(`${PRE_ADVICES_PATH}/${created.body.data.id}/cancel`);
      expect(response.body.data.status).toBe('CANCELLED');
    });
  });

  describe('expiry', () => {
    test('expires pre-advices whose slot end plus tolerance has passed, when reading', async () => {
      const pastSlot = await createTimeSlot(prisma, { date: '2026-09-30', startHour: 8 });
      const runningSlot = await createTimeSlot(prisma, { date: '2026-09-30', startHour: 9 });
      for (const tier of [2, 3]) {
        await placeContainer(prisma, {
          block: yard.B,
          row: 1,
          bay: 1,
          tier,
          companyId: company.id,
        });
      }
      const overdue = await createBookedPreAdvice(prisma, {
        companyId: company.id,
        timeSlotId: pastSlot.id,
        type: 'PICKUP',
        containerNumber: ownContainer.number,
        truckPlate: 'HH-LA 1',
        driverName: 'Late Driver',
        pin: '444444',
      });
      const stillOpen = await createBookedPreAdvice(prisma, {
        companyId: company.id,
        timeSlotId: runningSlot.id,
        type: 'DELIVERY',
        containerNumber: generateContainerNumber('DLVU', 11),
        truckPlate: 'HH-ON 1',
        driverName: 'On Time',
        pin: '555555',
      });
      await prisma.$transaction((transaction) =>
        createRelocationWorkOrders(transaction, {
          targetContainerId: ownContainer.id,
          reason: 'Test',
          actor: { id: users.ADMIN.id },
          auditService: createAuditService({ prisma }),
        }),
      );
      await admin.get(PRE_ADVICES_PATH);
      expect(await prisma.preAdvice.findUniqueOrThrow({ where: { id: overdue.id } })).toMatchObject(
        {
          status: 'EXPIRED',
        },
      );
      expect(
        await prisma.preAdvice.findUniqueOrThrow({ where: { id: stillOpen.id } }),
      ).toMatchObject({
        status: 'ACTIVE',
      });
      expect(await prisma.workOrder.count({ where: { status: 'CANCELLED' } })).toBe(2);
      const notification = await prisma.notification.findFirstOrThrow({
        where: { type: 'PRE_ADVICE_EXPIRED' },
      });
      expect(notification.message).toContain(overdue.reference);
      expect(await prisma.auditLog.count({ where: { action: 'EXPIRE' } })).toBe(1);
    });
  });
});
