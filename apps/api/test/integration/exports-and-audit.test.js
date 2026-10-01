import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import { parse } from 'csv-parse/sync';
import {
  USER_EMAILS,
  createCompany,
  createContainer,
  createHold,
  createInvoice,
  createSmallYard,
  createUsersForAllRoles,
  loginAs,
  placeContainer,
  resetDatabase,
} from '../helpers/fixtures.js';
import { createTestContext } from '../helpers/test-app.js';

const NOW = new Date('2026-09-30T08:20:00Z');

function readCsv(response) {
  return parse(response.text, { columns: true });
}

describe('CSV exports (spec 11)', () => {
  const { app, prisma, close } = createTestContext({ clock: () => NOW });
  let admin;
  let planner;
  let users;
  let containers;

  beforeEach(async () => {
    await resetDatabase(prisma);
    let company;
    ({ users, company } = await createUsersForAllRoles(prisma));
    const otherCompany = await createCompany(prisma, { code: 'OTH', name: 'Other Freight' });
    const yard = await createSmallYard(prisma);
    containers = [
      await placeContainer(prisma, {
        block: yard.B,
        row: 1,
        bay: 1,
        tier: 1,
        companyId: company.id,
        gateInAt: new Date('2026-09-28T08:00:00Z'),
      }),
      await createContainer(prisma, { companyId: otherCompany.id, state: 'EXPECTED' }),
    ];
    await createHold(prisma, { containerId: containers[0].id, placedById: users.ADMIN.id });
    await prisma.movement.createMany({
      data: [
        {
          containerId: containers[0].id,
          type: 'GATE_IN',
          toPosition: 'B-01-01-1',
          userId: users.GATE_OPERATOR.id,
          createdAt: new Date('2026-09-28T08:00:00Z'),
        },
        {
          containerId: containers[0].id,
          type: 'YARD_MOVE',
          fromPosition: 'B-02-02-1',
          toPosition: 'B-01-01-1',
          userId: users.PLANNER.id,
          createdAt: new Date('2026-09-29T22:30:00Z'),
        },
      ],
    });
    await createInvoice(prisma, {
      containerId: containers[0].id,
      status: 'UNPAID',
      amountCents: 4500,
      periodFrom: new Date('2026-09-28T08:00:00Z'),
      periodTo: NOW,
    });
    admin = await loginAs(app, USER_EMAILS.ADMIN);
    planner = await loginAs(app, USER_EMAILS.PLANNER);
  });

  afterAll(close);

  test('exports containers with the list filters', async () => {
    const response = await planner.get('/api/v1/exports/containers.csv');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toContain('containers.csv');
    const rows = readCsv(response);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.number === containers[0].number)).toMatchObject({
      state: 'IN_YARD',
      ownerCode: 'TST',
      positionCode: 'B-01-01-1',
      hasHold: 'true',
      dwellDays: '3',
      gateInAt: '2026-09-28T08:00:00.000Z',
      departedAt: '',
    });
    const filtered = readCsv(await planner.get('/api/v1/exports/containers.csv?state=EXPECTED'));
    expect(filtered.map((row) => row.ownerCode)).toEqual(['OTH']);
  });

  test('exports an empty file with only the header when nothing matches', async () => {
    const response = await planner.get('/api/v1/exports/containers.csv?blockCode=X');
    expect(response.text.trim().split('\n')).toEqual([
      'number,size,isHighCube,loadStatus,isDangerous,imoClass,grossWeightKg,state,ownerCode,positionCode,hasHold,gateInAt,departedAt,dwellDays',
    ]);
  });

  test('exports movements filtered by Berlin day and type', async () => {
    const all = readCsv(await planner.get('/api/v1/exports/movements.csv'));
    expect(all.map((row) => row.type)).toEqual(['GATE_IN', 'YARD_MOVE']);
    expect(all[1]).toMatchObject({ fromPosition: 'B-02-02-1', userName: 'Test planner' });
    const sameDay = readCsv(
      await planner.get('/api/v1/exports/movements.csv?from=2026-09-29&to=2026-09-29'),
    );
    expect(sameDay).toEqual([]);
    const berlinDay = readCsv(await planner.get('/api/v1/exports/movements.csv?from=2026-09-30'));
    expect(berlinDay.map((row) => row.type)).toEqual(['YARD_MOVE']);
    const byType = readCsv(await planner.get('/api/v1/exports/movements.csv?type=GATE_IN'));
    expect(byType).toHaveLength(1);
    const backwards = await planner.get(
      '/api/v1/exports/movements.csv?from=2026-09-30&to=2026-09-01',
    );
    expect(backwards.status).toBe(422);
  });

  test('exports invoices for admin with the amount in euro', async () => {
    const rows = readCsv(await admin.get('/api/v1/exports/invoices.csv?status=UNPAID'));
    expect(rows).toEqual([
      expect.objectContaining({
        containerNumber: containers[0].number,
        companyCode: 'TST',
        amountCents: '4500',
        amountEur: '45.00',
        status: 'UNPAID',
        paidAt: '',
      }),
    ]);
    expect((await planner.get('/api/v1/exports/invoices.csv')).status).toBe(403);
  });

  test('streams more rows than one batch', async () => {
    const company = await prisma.company.findFirstOrThrow({ where: { code: 'TST' } });
    await prisma.container.createMany({
      data: Array.from({ length: 520 }, (_, index) => ({
        number: `BLKU${String(index).padStart(6, '0')}`,
        size: 'FT40',
        loadStatus: 'FULL',
        ownerCompanyId: company.id,
        state: 'EXPECTED',
      })),
    });
    const rows = readCsv(await planner.get('/api/v1/exports/containers.csv?state=EXPECTED'));
    expect(rows).toHaveLength(521);
  });
});

describe('audit log viewer (spec 6.14)', () => {
  const { app, prisma, close } = createTestContext({ clock: () => NOW });
  let admin;
  let users;

  beforeEach(async () => {
    await resetDatabase(prisma);
    ({ users } = await createUsersForAllRoles(prisma));
    admin = await loginAs(app, USER_EMAILS.ADMIN);
    await loginAs(app, USER_EMAILS.PLANNER);
    await admin.patch(`/api/v1/users/${users.PLANNER.id}`).send({ name: 'Mira Pohl' });
    await prisma.auditLog.create({
      data: {
        action: 'MOVE',
        entity: 'Container',
        entityId: 'TSTU0000016',
        userId: users.PLANNER.id,
        createdAt: new Date('2026-09-01T10:00:00Z'),
      },
    });
  });

  afterAll(close);

  test('lists entries newest first with the user', async () => {
    const response = await admin.get('/api/v1/audit-logs');
    expect(response.status).toBe(200);
    expect(response.body.total).toBe(4);
    expect(response.body.data[0]).toMatchObject({
      action: 'UPDATE',
      entity: 'User',
      entityId: String(users.PLANNER.id),
      user: { id: users.ADMIN.id, email: USER_EMAILS.ADMIN },
      before: expect.objectContaining({ name: 'Test planner' }),
    });
  });

  test.each([
    ['action=login', 2],
    ['entity=Container', 1],
    [`entityId=${'TSTU0000016'}`, 1],
    ['from=2026-09-01&to=2026-09-01', 1],
  ])('filters with %s', async (queryString, total) => {
    const response = await admin.get(`/api/v1/audit-logs?${queryString}`);
    expect(response.body.total).toBe(total);
  });

  test('filters by user', async () => {
    const response = await admin.get(`/api/v1/audit-logs?userId=${users.PLANNER.id}`);
    expect(response.body.data.map((entry) => entry.action).sort()).toEqual(['LOGIN', 'MOVE']);
  });

  test('exports the filtered entries as CSV with JSON before and after', async () => {
    const response = await admin.get('/api/v1/audit-logs.csv?entity=User&action=UPDATE');
    expect(response.headers['content-disposition']).toContain('audit-logs.csv');
    const rows = readCsv(response);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'UPDATE', userEmail: USER_EMAILS.ADMIN });
    expect(JSON.parse(rows[0].after)).toMatchObject({ name: 'Mira Pohl' });
    expect(rows[0].after).not.toContain('passwordHash');
  });

  test('rejects a date range that ends before it starts', async () => {
    const response = await admin.get('/api/v1/audit-logs?from=2026-09-30&to=2026-09-01');
    expect(response.status).toBe(422);
  });
});
