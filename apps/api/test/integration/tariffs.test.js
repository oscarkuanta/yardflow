import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import {
  USER_EMAILS,
  createTariffs,
  createUsersForAllRoles,
  loginAs,
  resetDatabase,
} from '../helpers/fixtures.js';
import { createTestContext } from '../helpers/test-app.js';

const TARIFFS_PATH = '/api/v1/tariffs';

describe('tariffs', () => {
  const { app, prisma, close } = createTestContext();
  let admin;

  beforeEach(async () => {
    await resetDatabase(prisma);
    await createUsersForAllRoles(prisma);
    await createTariffs(prisma);
    admin = await loginAs(app, USER_EMAILS.ADMIN);
  });

  afterAll(close);

  test('lists all six tariffs', async () => {
    const response = await admin.get(TARIFFS_PATH);
    expect(response.body.total).toBe(6);
    expect(response.body.data[0]).toMatchObject({
      size: 'FT20',
      isDangerous: false,
      freeDays: 5,
      dailyRateCents: 900,
    });
  });

  test('changes the rate of one tariff, identified by size and DG flag, and audits it', async () => {
    const response = await admin
      .patch(TARIFFS_PATH)
      .send({ size: 'FT40', isDangerous: true, dailyRateCents: 3200 });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ size: 'FT40', freeDays: 3, dailyRateCents: 3200 });
    const untouched = await prisma.tariff.findUniqueOrThrow({
      where: { size_isDangerous: { size: 'FT40', isDangerous: false } },
    });
    expect(untouched.dailyRateCents).toBe(1500);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entity: 'Tariff' } });
    expect(audit.before.dailyRateCents).toBe(3000);
    expect(audit.after.dailyRateCents).toBe(3200);
  });

  test('changes free days only', async () => {
    const response = await admin
      .patch(TARIFFS_PATH)
      .send({ size: 'FT20', isDangerous: false, freeDays: 7 });
    expect(response.body.data).toMatchObject({ freeDays: 7, dailyRateCents: 900 });
  });

  test.each([
    ['nothing to change', { size: 'FT20', isDangerous: false }],
    ['a negative rate', { size: 'FT20', isDangerous: false, dailyRateCents: -1 }],
    ['a rate in euros with decimals', { size: 'FT20', isDangerous: false, dailyRateCents: 9.5 }],
    ['an unknown size', { size: 'FT53', isDangerous: false, freeDays: 1 }],
    ['a missing DG flag', { size: 'FT20', freeDays: 1 }],
  ])('rejects %s with 422', async (_label, body) => {
    expect((await admin.patch(TARIFFS_PATH).send(body)).status).toBe(422);
  });

  test('answers 404 when the tariff does not exist', async () => {
    await prisma.tariff.deleteMany({ where: { size: 'FT45' } });
    const response = await admin
      .patch(TARIFFS_PATH)
      .send({ size: 'FT45', isDangerous: false, freeDays: 1 });
    expect(response.status).toBe(404);
  });
});
