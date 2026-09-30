import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import {
  USER_EMAILS,
  createUsersForAllRoles,
  loginAs,
  resetDatabase,
} from '../helpers/fixtures.js';
import { createTestContext } from '../helpers/test-app.js';

const USERS_PATH = '/api/v1/users';
const NEW_PASSWORD = 'new-password-123';

describe('users', () => {
  const { app, prisma, close } = createTestContext();
  let admin;
  let users;
  let company;

  beforeEach(async () => {
    await resetDatabase(prisma);
    ({ users, company } = await createUsersForAllRoles(prisma));
    admin = await loginAs(app, USER_EMAILS.ADMIN);
  });

  afterAll(close);

  describe('GET /users', () => {
    test('returns a page with data, page, pageSize and total, sorted by name', async () => {
      const response = await admin.get(`${USERS_PATH}?pageSize=2`);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ page: 1, pageSize: 2, total: 4 });
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).not.toHaveProperty('passwordHash');
      const names = response.body.data.map((user) => user.name);
      expect(names).toEqual([...names].sort());
    });

    test('filters by role, company, active flag and search text', async () => {
      const byRole = await admin.get(`${USERS_PATH}?role=CUSTOMER`);
      expect(byRole.body.data.map((user) => user.email)).toEqual([USER_EMAILS.CUSTOMER]);
      const byCompany = await admin.get(`${USERS_PATH}?companyId=${company.id}`);
      expect(byCompany.body.total).toBe(1);
      const bySearch = await admin.get(`${USERS_PATH}?search=planner`);
      expect(bySearch.body.data.map((user) => user.role)).toEqual(['PLANNER']);
      const inactive = await admin.get(`${USERS_PATH}?isActive=false`);
      expect(inactive.body.total).toBe(0);
    });

    test('sorts descending and pages through the results', async () => {
      const second = await admin.get(`${USERS_PATH}?sort=email:desc&page=2&pageSize=1`);
      expect(second.body.data[0].email).toBe(USER_EMAILS.GATE_OPERATOR);
    });

    test.each([
      ['sort=passwordHash:asc', 'query.sort'],
      ['sort=name', 'query.sort'],
      ['pageSize=500', 'query.pageSize'],
      ['page=0', 'query.page'],
      ['isActive=yes', 'query.isActive'],
    ])('rejects %s with 422', async (queryString, field) => {
      const response = await admin.get(`${USERS_PATH}?${queryString}`);
      expect(response.status).toBe(422);
      expect(response.body.error.details[0].field).toBe(field);
    });
  });

  describe('POST /users', () => {
    const newPlanner = {
      email: 'New.Planner@Test.Example',
      name: 'Nina Planner',
      password: NEW_PASSWORD,
      role: 'PLANNER',
    };

    test('creates a staff user who can log in, and audits it without the password', async () => {
      const response = await admin.post(USERS_PATH).send(newPlanner);
      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        email: 'new.planner@test.example',
        role: 'PLANNER',
        companyId: null,
        isActive: true,
      });
      await loginAs(app, 'new.planner@test.example', NEW_PASSWORD);
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'CREATE', entity: 'User' },
      });
      expect(audit.entityId).toBe(String(response.body.data.id));
      expect(JSON.stringify(audit)).not.toContain(NEW_PASSWORD);
      expect(JSON.stringify(audit)).not.toContain('passwordHash');
    });

    test('creates a customer for an existing company', async () => {
      const response = await admin
        .post(USERS_PATH)
        .send({ ...newPlanner, role: 'CUSTOMER', companyId: company.id });
      expect(response.status).toBe(201);
      expect(response.body.data.company).toMatchObject({ id: company.id, code: 'TST' });
    });

    test.each([
      [{ role: 'CUSTOMER' }, 'A customer user must belong to a company'],
      [{ role: 'PLANNER', companyId: 'COMPANY' }, 'Staff users cannot belong to a company'],
      [{ role: 'CUSTOMER', companyId: 999999 }, 'Company not found'],
    ])('rejects %j with 422', async (changes, message) => {
      const body = {
        ...newPlanner,
        ...changes,
        companyId: changes.companyId === 'COMPANY' ? company.id : changes.companyId,
      };
      const response = await admin.post(USERS_PATH).send(body);
      expect(response.status).toBe(422);
      expect(response.body.error.details).toEqual([{ field: 'body.companyId', message }]);
    });

    test('rejects a duplicate email with 409', async () => {
      const response = await admin
        .post(USERS_PATH)
        .send({ ...newPlanner, email: USER_EMAILS.GATE_OPERATOR.toUpperCase() });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('EMAIL_TAKEN');
    });

    test('rejects a short password, an unknown role and extra fields', async () => {
      const response = await admin
        .post(USERS_PATH)
        .send({ ...newPlanner, password: 'short', role: 'BOSS', passwordHash: 'x' });
      expect(response.status).toBe(422);
      const fields = response.body.error.details.map((detail) => detail.field);
      expect(fields).toEqual(expect.arrayContaining(['body.password', 'body.role', 'body']));
    });
  });

  describe('PATCH /users/:id', () => {
    test('changes the name and audits before and after', async () => {
      const response = await admin
        .patch(`${USERS_PATH}/${users.PLANNER.id}`)
        .send({ name: 'Mira Pohl' });
      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Mira Pohl');
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'UPDATE', entity: 'User' },
      });
      expect(audit.before.name).toBe('Test planner');
      expect(audit.after).toMatchObject({ name: 'Mira Pohl', passwordChanged: false });
    });

    test('sets a new password that works for the next login', async () => {
      await admin.patch(`${USERS_PATH}/${users.GATE_OPERATOR.id}`).send({ password: NEW_PASSWORD });
      await loginAs(app, USER_EMAILS.GATE_OPERATOR, NEW_PASSWORD);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'UPDATE' } });
      expect(audit.after.passwordChanged).toBe(true);
      expect(JSON.stringify(audit)).not.toContain(NEW_PASSWORD);
    });

    test('deactivating a user destroys their sessions at once', async () => {
      const customer = await loginAs(app, USER_EMAILS.CUSTOMER);
      expect(await prisma.session.count()).toBe(2);
      const response = await admin
        .patch(`${USERS_PATH}/${users.CUSTOMER.id}`)
        .send({ isActive: false });
      expect(response.body.data.isActive).toBe(false);
      expect(await prisma.session.count()).toBe(1);
      expect((await customer.get('/api/v1/auth/me')).status).toBe(401);
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: USER_EMAILS.CUSTOMER, password: 'correct-horse-42' });
      expect(login.status).toBe(401);
    });

    test('lets a reactivated user log in again', async () => {
      await admin.patch(`${USERS_PATH}/${users.PLANNER.id}`).send({ isActive: false });
      await admin.patch(`${USERS_PATH}/${users.PLANNER.id}`).send({ isActive: true });
      await loginAs(app, USER_EMAILS.PLANNER);
    });

    test.each([
      [{ isActive: false }, 'You cannot deactivate your own account'],
      [{ role: 'PLANNER' }, 'You cannot remove your own admin role'],
    ])(
      'protects the admin from locking out their own account with %j',
      async (changes, message) => {
        const response = await admin.patch(`${USERS_PATH}/${users.ADMIN.id}`).send(changes);
        expect(response.status).toBe(409);
        expect(response.body.error).toMatchObject({ code: 'OWN_ACCESS_PROTECTED', message });
      },
    );

    test('moves a customer to a staff role only together with companyId null', async () => {
      const withoutCompany = await admin
        .patch(`${USERS_PATH}/${users.CUSTOMER.id}`)
        .send({ role: 'PLANNER' });
      expect(withoutCompany.status).toBe(422);
      const withCompany = await admin
        .patch(`${USERS_PATH}/${users.CUSTOMER.id}`)
        .send({ role: 'PLANNER', companyId: null });
      expect(withCompany.status).toBe(200);
      expect(withCompany.body.data).toMatchObject({ role: 'PLANNER', company: null });
    });

    test('rejects an email that another user has with 409', async () => {
      const response = await admin
        .patch(`${USERS_PATH}/${users.PLANNER.id}`)
        .send({ email: USER_EMAILS.GATE_OPERATOR });
      expect(response.status).toBe(409);
    });

    test.each([
      ['an empty body', {}],
      ['an unknown field', { passwordHash: 'x' }],
    ])('rejects %s with 422', async (_label, body) => {
      const response = await admin.patch(`${USERS_PATH}/${users.PLANNER.id}`).send(body);
      expect(response.status).toBe(422);
    });

    test('answers 404 for an unknown user and 422 for an id that is not a number', async () => {
      expect((await admin.patch(`${USERS_PATH}/999999`).send({ name: 'X' })).status).toBe(404);
      expect((await admin.patch(`${USERS_PATH}/abc`).send({ name: 'X' })).status).toBe(422);
    });
  });
});
