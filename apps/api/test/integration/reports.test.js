import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import {
  USER_EMAILS,
  createBookedPreAdvice,
  createContainer,
  createHold,
  createSmallYard,
  createTimeSlot,
  createUsersForAllRoles,
  loginAs,
  nextContainerNumber,
  placeContainer,
  resetDatabase,
} from '../helpers/fixtures.js';
import { createTestContext } from '../helpers/test-app.js';

const REPORTS_PATH = '/api/v1/reports';
const TEN_TWENTY_BERLIN = new Date('2026-09-30T08:20:00Z');
const HOUR_MS = 60 * 60 * 1000;

function hoursBefore(hours) {
  return new Date(TEN_TWENTY_BERLIN.getTime() - hours * HOUR_MS);
}

describe('reports (spec 11)', () => {
  const clock = { now: TEN_TWENTY_BERLIN };
  const { app, prisma, close } = createTestContext({ clock: () => clock.now });
  let planner;
  let users;
  let company;
  let inYard;

  async function gateTransaction(direction, createdAt, slot) {
    const container = await createContainer(prisma, { companyId: company.id, state: 'DEPARTED' });
    const preAdvice = await createBookedPreAdvice(prisma, {
      companyId: company.id,
      timeSlotId: slot.id,
      type: direction === 'IN' ? 'DELIVERY' : 'PICKUP',
      containerNumber: container.number,
      truckPlate: 'HH-RP 1',
      driverName: 'Report Driver',
      pin: '111111',
      status: 'USED',
    });
    return prisma.gateTransaction.create({
      data: {
        direction,
        preAdviceId: preAdvice.id,
        containerId: container.id,
        truckPlate: 'HH-RP 1',
        driverName: 'Report Driver',
        lane: 1,
        operatorId: users.GATE_OPERATOR.id,
        createdAt,
      },
    });
  }

  beforeEach(async () => {
    clock.now = TEN_TWENTY_BERLIN;
    await resetDatabase(prisma);
    ({ users, company } = await createUsersForAllRoles(prisma));
    const yard = await createSmallYard(prisma);
    inYard = [
      await placeContainer(prisma, {
        block: yard.B,
        row: 1,
        bay: 1,
        tier: 1,
        companyId: company.id,
        gateInAt: hoursBefore(48),
      }),
      await placeContainer(prisma, {
        block: yard.B,
        row: 1,
        bay: 1,
        tier: 2,
        companyId: company.id,
        gateInAt: hoursBefore(96),
      }),
      await placeContainer(prisma, {
        block: yard.A,
        row: 1,
        bay: 1,
        tier: 1,
        companyId: company.id,
        size: 'FT20',
        gateInAt: hoursBefore(24),
      }),
    ];
    planner = await loginAs(app, USER_EMAILS.PLANNER);
  });

  afterAll(close);

  test('GET /reports/kpis sums up the yard, the gate, work orders, holds and dwell', async () => {
    const slot = await createTimeSlot(prisma, { date: '2026-09-30', startHour: 10 });
    await gateTransaction('IN', hoursBefore(1), slot);
    await gateTransaction('IN', hoursBefore(2), slot);
    await gateTransaction('OUT', hoursBefore(0.5), slot);
    await gateTransaction('IN', hoursBefore(24), slot);
    for (const pin of ['222222', '333333']) {
      await createBookedPreAdvice(prisma, {
        companyId: company.id,
        timeSlotId: slot.id,
        type: 'DELIVERY',
        containerNumber: nextContainerNumber(),
        truckPlate: `HH-EX ${pin}`,
        driverName: 'Expected Driver',
        pin,
      });
    }
    await prisma.workOrder.create({
      data: {
        containerId: inYard[1].id,
        targetContainerId: inYard[0].id,
        fromPosition: 'B-01-01-2',
        toPosition: 'B-02-02-1',
        sequence: 1,
        groupKey: '00000000-0000-4000-8000-000000000001',
        reason: 'Test',
        createdAt: hoursBefore(1.5),
      },
    });
    await createHold(prisma, { containerId: inYard[0].id, placedById: users.ADMIN.id });
    await createHold(prisma, {
      containerId: inYard[1].id,
      placedById: users.ADMIN.id,
      releasedAt: hoursBefore(1),
    });

    const response = await planner.get(`${REPORTS_PATH}/kpis`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      occupancy: { containersInYard: 3, teuUsed: 5, teuCapacity: 70, percent: 7.1 },
      gateMovesToday: { in: 2, out: 1, total: 3 },
      currentSlot: {
        startsAt: '2026-09-30T08:00:00.000Z',
        endsAt: '2026-09-30T09:00:00.000Z',
        expectedTrucks: 2,
      },
      openWorkOrders: { count: 1, oldestAgeMinutes: 90 },
      activeHolds: 1,
      averageDwellDays: 2.3,
      generatedAt: TEN_TWENTY_BERLIN.toISOString(),
    });
  });

  test('reports no current slot outside gate hours', async () => {
    clock.now = new Date('2026-09-30T18:00:00Z');
    const response = await planner.get(`${REPORTS_PATH}/kpis`);
    expect(response.body.data.currentSlot).toBeNull();
    expect(response.body.data.openWorkOrders).toEqual({ count: 0, oldestAgeMinutes: null });
  });

  test('GET /reports/occupancy returns one row per block', async () => {
    const response = await planner.get(`${REPORTS_PATH}/occupancy`);
    expect(response.body.data.map((block) => [block.code, block.usedSlots, block.teuUsed])).toEqual(
      [
        ['A', 1, 1],
        ['B', 2, 4],
        ['E', 0, 0],
        ['X', 0, 0],
      ],
    );
  });

  test('GET /reports/gate-moves returns in and out per day, today last', async () => {
    const slot = await createTimeSlot(prisma, { date: '2026-09-30', startHour: 10 });
    await gateTransaction('IN', hoursBefore(1), slot);
    await gateTransaction('OUT', hoursBefore(26), slot);
    const response = await planner.get(`${REPORTS_PATH}/gate-moves?days=3`);
    expect(response.body.data).toEqual([
      { date: '2026-09-28', in: 0, out: 0 },
      { date: '2026-09-29', in: 0, out: 1 },
      { date: '2026-09-30', in: 1, out: 0 },
    ]);
    expect((await planner.get(`${REPORTS_PATH}/gate-moves`)).body.data).toHaveLength(14);
    expect((await planner.get(`${REPORTS_PATH}/gate-moves?days=90`)).status).toBe(422);
  });

  test('GET /reports/dwell returns 8 weeks of average dwell for departed containers', async () => {
    await createContainer(prisma, {
      companyId: company.id,
      state: 'DEPARTED',
      gateInAt: new Date('2026-09-20T08:00:00Z'),
      departedAt: new Date('2026-09-29T08:00:00Z'),
    });
    const response = await planner.get(`${REPORTS_PATH}/dwell`);
    expect(response.body.data).toHaveLength(8);
    expect(response.body.data.at(-1)).toEqual({
      weekStart: '2026-09-28',
      departures: 1,
      averageDwellDays: 9,
    });
    expect(response.body.data[0].weekStart).toBe('2026-08-10');
  });
});
