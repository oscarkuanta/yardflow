import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import {
  USER_EMAILS,
  createPreAdvice,
  createUsersForAllRoles,
  loginAs,
  resetDatabase,
} from '../helpers/fixtures.js';
import { createTestContext } from '../helpers/test-app.js';

const SLOTS_PATH = '/api/v1/time-slots';
const WEDNESDAY_10_AM_BERLIN = new Date('2026-09-30T08:00:00Z');
const TODAY = '2026-09-30';
const TOMORROW = '2026-10-01';
const SUNDAY = '2026-10-04';
const LAST_BOOKABLE_DAY = '2026-10-14';

describe('time slots', () => {
  const { app, prisma, close } = createTestContext({ clock: () => WEDNESDAY_10_AM_BERLIN });
  let admin;
  let company;

  beforeEach(async () => {
    await resetDatabase(prisma);
    ({ company } = await createUsersForAllRoles(prisma));
    admin = await loginAs(app, USER_EMAILS.ADMIN);
  });

  afterAll(close);

  async function slotAt(date, startHour) {
    await admin.get(`${SLOTS_PATH}?date=${date}`);
    return prisma.timeSlot.findUniqueOrThrow({
      where: { date_startHour: { date: new Date(`${date}T00:00:00Z`), startHour } },
    });
  }

  async function book(slot, count, status = 'ACTIVE') {
    for (let index = 0; index < count; index += 1) {
      await createPreAdvice(prisma, { companyId: company.id, timeSlotId: slot.id, status });
    }
  }

  describe('GET /time-slots', () => {
    test('creates the 9 hourly slots of a day on demand with the default capacity', async () => {
      const response = await admin.get(`${SLOTS_PATH}?date=${TOMORROW}`);
      expect(response.status).toBe(200);
      expect(response.body.data.map((slot) => slot.startHour)).toEqual([
        8, 9, 10, 11, 12, 13, 14, 15, 16,
      ]);
      expect(response.body.data[0]).toEqual({
        id: expect.any(Number),
        date: TOMORROW,
        startHour: 8,
        startsAt: '2026-10-01T06:00:00.000Z',
        endsAt: '2026-10-01T07:00:00.000Z',
        capacity: 10,
        booked: 0,
        remaining: 10,
        isFull: false,
      });
    });

    test('does not create the slots twice', async () => {
      await admin.get(`${SLOTS_PATH}?date=${TOMORROW}`);
      await admin.get(`${SLOTS_PATH}?date=${TOMORROW}`);
      expect(await prisma.timeSlot.count()).toBe(9);
    });

    test('counts ACTIVE and USED bookings, but not cancelled or expired ones', async () => {
      const slot = await slotAt(TOMORROW, 9);
      await book(slot, 2, 'ACTIVE');
      await book(slot, 1, 'USED');
      await book(slot, 3, 'CANCELLED');
      await book(slot, 1, 'EXPIRED');
      const response = await admin.get(`${SLOTS_PATH}?date=${TOMORROW}`);
      expect(response.body.data[1]).toMatchObject({ booked: 3, remaining: 7, isFull: false });
    });

    test('marks a slot full when bookings reach the capacity', async () => {
      const slot = await slotAt(TOMORROW, 8);
      await prisma.timeSlot.update({ where: { id: slot.id }, data: { capacity: 2 } });
      await book(slot, 2);
      const response = await admin.get(`${SLOTS_PATH}?date=${TOMORROW}`);
      expect(response.body.data[0]).toMatchObject({ booked: 2, remaining: 0, isFull: true });
    });

    test('has no slots on Sunday', async () => {
      const response = await admin.get(`${SLOTS_PATH}?date=${SUNDAY}`);
      expect(response.body.data).toEqual([]);
    });

    test('offers slots up to 14 days ahead and refuses later dates', async () => {
      expect((await admin.get(`${SLOTS_PATH}?date=${LAST_BOOKABLE_DAY}`)).body.data).toHaveLength(
        9,
      );
      const tooFar = await admin.get(`${SLOTS_PATH}?date=2026-10-15`);
      expect(tooFar.status).toBe(422);
      expect(tooFar.body.error.details[0]).toEqual({
        field: 'query.date',
        message: 'Time slots exist only up to 14 days ahead',
      });
    });

    test('shows existing slots of a past day without creating new ones', async () => {
      const response = await admin.get(`${SLOTS_PATH}?date=2026-09-29`);
      expect(response.body.data).toEqual([]);
      expect(await prisma.timeSlot.count()).toBe(0);
    });

    test.each(['2026-02-30', '30.09.2026', 'tomorrow'])('rejects the date %s', async (date) => {
      const response = await admin.get(`${SLOTS_PATH}?date=${date}`);
      expect(response.status).toBe(422);
    });

    test('lets a customer read the slots of today', async () => {
      const customer = await loginAs(app, USER_EMAILS.CUSTOMER);
      expect((await customer.get(`${SLOTS_PATH}?date=${TODAY}`)).body.data).toHaveLength(9);
    });
  });

  describe('PATCH /time-slots', () => {
    test('changes the capacity of one slot and audits it', async () => {
      const slot = await slotAt(TOMORROW, 10);
      const response = await admin.patch(SLOTS_PATH).send({ slotId: slot.id, capacity: 4 });
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([expect.objectContaining({ id: slot.id, capacity: 4 })]);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { entity: 'TimeSlot' } });
      expect(audit).toMatchObject({ action: 'UPDATE_CAPACITY', entityId: String(slot.id) });
      expect(audit.before).toEqual([{ id: slot.id, startHour: 10, capacity: 10 }]);
    });

    test('changes the capacity of a whole day, creating its slots first', async () => {
      const response = await admin.patch(SLOTS_PATH).send({ date: TOMORROW, capacity: 12 });
      expect(response.body.data).toHaveLength(9);
      expect(await prisma.timeSlot.count({ where: { capacity: 12 } })).toBe(9);
    });

    test('never sets a slot below its bookings', async () => {
      const slot = await slotAt(TOMORROW, 11);
      await book(slot, 3);
      const response = await admin.patch(SLOTS_PATH).send({ slotId: slot.id, capacity: 2 });
      expect(response.status).toBe(409);
      expect(response.body.error).toMatchObject({
        code: 'CAPACITY_BELOW_BOOKINGS',
        details: [{ slotId: slot.id, startHour: 11, booked: 3 }],
      });
      expect(await admin.patch(SLOTS_PATH).send({ slotId: slot.id, capacity: 3 })).toMatchObject({
        status: 200,
      });
    });

    test('changes nothing for a whole day when one slot has too many bookings', async () => {
      const slot = await slotAt(TOMORROW, 15);
      await book(slot, 5);
      const response = await admin.patch(SLOTS_PATH).send({ date: TOMORROW, capacity: 4 });
      expect(response.status).toBe(409);
      expect(await prisma.timeSlot.count({ where: { capacity: 4 } })).toBe(0);
    });

    test.each([
      ['both slotId and date', { slotId: 1, date: TOMORROW, capacity: 5 }],
      ['neither slotId nor date', { capacity: 5 }],
      ['a negative capacity', { date: TOMORROW, capacity: -1 }],
      ['a Sunday', { date: SUNDAY, capacity: 5 }],
      ['a day more than 14 days ahead', { date: '2026-10-20', capacity: 5 }],
    ])('rejects %s with 422', async (_label, body) => {
      expect((await admin.patch(SLOTS_PATH).send(body)).status).toBe(422);
    });

    test('answers 404 for an unknown slot or a past day without slots', async () => {
      expect((await admin.patch(SLOTS_PATH).send({ slotId: 999999, capacity: 5 })).status).toBe(
        404,
      );
      expect((await admin.patch(SLOTS_PATH).send({ date: '2026-09-28', capacity: 5 })).status).toBe(
        404,
      );
    });
  });
});
