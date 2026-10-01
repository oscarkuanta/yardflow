import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import {
  averageGateInMinutes,
  maskContainerNumber,
  maskTruckPlate,
} from '../../src/modules/public/public-stats.js';
import {
  createBookedPreAdvice,
  createContainer,
  createSmallYard,
  createTimeSlot,
  createUsersForAllRoles,
  placeContainer,
  resetDatabase,
} from '../helpers/fixtures.js';
import { createTestContext } from '../helpers/test-app.js';

const NOW = new Date('2026-09-30T08:20:00Z');

describe('masking for public numbers', () => {
  test('keeps only the region and the last character of a truck plate', () => {
    expect(maskTruckPlate('HH-YF 482')).toBe('HH-•• ••2');
    expect(maskTruckPlate('ROS-AB 12')).toBe('ROS-•• •2');
    expect(maskTruckPlate('B 1234')).toBe('•••••4');
  });

  test('hides the start of the serial of a container number', () => {
    expect(maskContainerNumber('HNFU2045711')).toBe('HNFU •••571 1');
  });

  test('averages minutes from truck check to gate-in, ignoring missing checks', () => {
    const verified = new Map([
      [1, new Date('2026-09-30T08:00:00Z')],
      [2, new Date('2026-09-30T08:10:00Z')],
    ]);
    const gateIns = [
      { preAdviceId: 1, createdAt: new Date('2026-09-30T08:03:00Z') },
      { preAdviceId: 2, createdAt: new Date('2026-09-30T08:16:00Z') },
      { preAdviceId: 3, createdAt: new Date('2026-09-30T08:20:00Z') },
    ];
    expect(averageGateInMinutes(gateIns, verified)).toBe(4.5);
    expect(averageGateInMinutes([], verified)).toBeNull();
  });
});

describe('GET /public/stats', () => {
  const clock = { now: NOW };
  const { app, prisma, close } = createTestContext({ clock: () => clock.now });
  let users;
  let company;

  beforeEach(async () => {
    clock.now = NOW;
    await resetDatabase(prisma);
    ({ users, company } = await createUsersForAllRoles(prisma));
    const yard = await createSmallYard(prisma);
    await placeContainer(prisma, {
      block: yard.B,
      row: 1,
      bay: 1,
      tier: 1,
      companyId: company.id,
      gateInAt: new Date('2026-09-28T08:20:00Z'),
    });
    const slot = await createTimeSlot(prisma, { date: '2026-09-30', startHour: 10 });
    const container = await createContainer(prisma, { companyId: company.id, state: 'DEPARTED' });
    const preAdvice = await createBookedPreAdvice(prisma, {
      companyId: company.id,
      timeSlotId: slot.id,
      type: 'DELIVERY',
      containerNumber: container.number,
      truckPlate: 'HH-YF 482',
      driverName: 'Jan Becker',
      pin: '111111',
      status: 'USED',
    });
    await prisma.gateTransaction.create({
      data: {
        direction: 'IN',
        preAdviceId: preAdvice.id,
        containerId: container.id,
        truckPlate: 'HH-YF 482',
        driverName: 'Jan Becker',
        lane: 1,
        operatorId: users.GATE_OPERATOR.id,
        createdAt: new Date('2026-09-30T08:05:00Z'),
      },
    });
    await prisma.auditLog.create({
      data: {
        action: 'GATE_TRUCK_VERIFIED',
        entity: 'PreAdvice',
        entityId: String(preAdvice.id),
        createdAt: new Date('2026-09-30T08:01:00Z'),
      },
    });
  });

  afterAll(close);

  test('answers without login and masks plates and container numbers', async () => {
    const response = await request(app).get('/api/v1/public/stats');
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      containersInYard: 1,
      occupancyPercent: 2.9,
      gateMovesToday: 1,
      averageDwellDays: 2,
      averageGateInMinutes: 4,
      recentGateEvents: [{ kind: 'IN', plate: 'HH-•• ••2', lane: 1, size: 'FT40' }],
    });
    expect(response.body.data.recentGateEvents[0].containerNumber).toMatch(/^TSTU •••\d{3} \d$/);
    expect(JSON.stringify(response.body)).not.toContain('HH-YF 482');
    expect(JSON.stringify(response.body)).not.toContain('Jan Becker');
  });

  test('serves the cached numbers for 15 seconds', async () => {
    await request(app).get('/api/v1/public/stats');
    await prisma.containerPosition.deleteMany();
    clock.now = new Date(NOW.getTime() + 10000);
    const cached = await request(app).get('/api/v1/public/stats');
    expect(cached.body.data.containersInYard).toBe(1);
    clock.now = new Date(NOW.getTime() + 16000);
    const fresh = await request(app).get('/api/v1/public/stats');
    expect(fresh.body.data.containersInYard).toBe(0);
  });
});
