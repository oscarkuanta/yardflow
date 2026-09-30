import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import {
  TEST_PASSWORD,
  USER_EMAILS,
  createUsersForAllRoles,
  loginAs,
  resetDatabase,
} from '../helpers/fixtures.js';
import { createTestContext } from '../helpers/test-app.js';

const COMPANIES_PATH = '/api/v1/companies';

describe('companies', () => {
  const { app, prisma, close } = createTestContext();
  let admin;
  let company;

  beforeEach(async () => {
    await resetDatabase(prisma);
    ({ company } = await createUsersForAllRoles(prisma));
    admin = await loginAs(app, USER_EMAILS.ADMIN);
  });

  afterAll(close);

  test('creates a company with an uppercase code and audits it', async () => {
    const response = await admin
      .post(COMPANIES_PATH)
      .send({ code: 'hnf', name: 'Hanse North Freight', contactEmail: 'ops@hansenorth.example' });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ code: 'HNF', isActive: true, userCount: 0 });
    expect(await prisma.auditLog.count({ where: { entity: 'Company', action: 'CREATE' } })).toBe(1);
  });

  test('rejects a duplicate code with 409', async () => {
    const response = await admin
      .post(COMPANIES_PATH)
      .send({ code: 'TST', name: 'Other', contactEmail: 'other@test.example' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('COMPANY_CODE_TAKEN');
  });

  test.each(['AB', 'ABCD', 'A1C'])('rejects the code %s with 422', async (code) => {
    const response = await admin
      .post(COMPANIES_PATH)
      .send({ code, name: 'Other', contactEmail: 'other@test.example' });
    expect(response.status).toBe(422);
    expect(response.body.error.details[0]).toEqual({
      field: 'body.code',
      message: 'Company code must be exactly 3 letters',
    });
  });

  test('lists companies with their user count and filters by search', async () => {
    await admin
      .post(COMPANIES_PATH)
      .send({ code: 'NRT', name: 'Nordtrans Logistics', contactEmail: 'ops@nordtrans.example' });
    const all = await admin.get(COMPANIES_PATH);
    expect(all.body.total).toBe(2);
    expect(all.body.data.find((item) => item.code === 'TST').userCount).toBe(1);
    const search = await admin.get(`${COMPANIES_PATH}?search=nord`);
    expect(search.body.data.map((item) => item.code)).toEqual(['NRT']);
  });

  test('updates the name and refuses to change the code', async () => {
    const renamed = await admin
      .patch(`${COMPANIES_PATH}/${company.id}`)
      .send({ name: 'Test Freight GmbH' });
    expect(renamed.body.data.name).toBe('Test Freight GmbH');
    const codeChange = await admin.patch(`${COMPANIES_PATH}/${company.id}`).send({ code: 'NEW' });
    expect(codeChange.status).toBe(422);
  });

  test('deactivating a company logs out its customers and blocks their login', async () => {
    const customer = await loginAs(app, USER_EMAILS.CUSTOMER);
    await admin.patch(`${COMPANIES_PATH}/${company.id}`).send({ isActive: false });
    expect((await customer.get('/api/v1/auth/me')).status).toBe(401);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: USER_EMAILS.CUSTOMER, password: TEST_PASSWORD });
    expect(login.status).toBe(401);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'LOGIN_FAILED' } });
    expect(audit.after.reason).toBe('INACTIVE_COMPANY');

    await admin.patch(`${COMPANIES_PATH}/${company.id}`).send({ isActive: true });
    await loginAs(app, USER_EMAILS.CUSTOMER);
  });

  test('answers 404 for an unknown company', async () => {
    const response = await admin.patch(`${COMPANIES_PATH}/999999`).send({ name: 'X' });
    expect(response.status).toBe(404);
  });
});
