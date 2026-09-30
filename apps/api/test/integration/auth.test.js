import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import {
  TEST_PASSWORD,
  USER_EMAILS,
  createUsersForAllRoles,
  loginAs,
  resetDatabase,
  sessionCookieOf,
} from '../helpers/fixtures.js';
import { createTestContext } from '../helpers/test-app.js';

const LOGIN_PATH = '/api/v1/auth/login';
const LOGOUT_PATH = '/api/v1/auth/logout';
const ME_PATH = '/api/v1/auth/me';

describe('auth', () => {
  const { app, prisma, close } = createTestContext();
  let users;
  let company;

  beforeEach(async () => {
    await resetDatabase(prisma);
    ({ users, company } = await createUsersForAllRoles(prisma));
  });

  afterAll(close);

  describe('POST /auth/login', () => {
    test.each(Object.entries(USER_EMAILS))('logs in a %s user', async (role, email) => {
      const response = await request(app).post(LOGIN_PATH).send({ email, password: TEST_PASSWORD });
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ email, role });
      expect(response.body.data).not.toHaveProperty('passwordHash');
    });

    test('sets an httpOnly, SameSite=Lax session cookie that is not Secure outside production', async () => {
      const response = await request(app)
        .post(LOGIN_PATH)
        .send({ email: USER_EMAILS.ADMIN, password: TEST_PASSWORD });
      const cookie = sessionCookieOf(response);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).not.toContain('Secure');
    });

    test('ignores case and surrounding spaces in the email', async () => {
      const response = await request(app)
        .post(LOGIN_PATH)
        .send({ email: '  ADMIN@Test.Example ', password: TEST_PASSWORD });
      expect(response.status).toBe(200);
    });

    test('stores lastLoginAt and writes a LOGIN audit entry', async () => {
      await request(app)
        .post(LOGIN_PATH)
        .send({ email: USER_EMAILS.ADMIN, password: TEST_PASSWORD });
      const admin = await prisma.user.findUniqueOrThrow({ where: { id: users.ADMIN.id } });
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'LOGIN' } });
      expect(admin.lastLoginAt).not.toBeNull();
      expect(audit).toMatchObject({
        userId: users.ADMIN.id,
        entity: 'User',
        entityId: String(users.ADMIN.id),
      });
      expect(audit.ip).toBeTruthy();
    });

    test('rejects a wrong password with 401, sets no cookie and audits the failure', async () => {
      const response = await request(app)
        .post(LOGIN_PATH)
        .send({ email: USER_EMAILS.ADMIN, password: 'wrong-password' });
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email or password is incorrect',
          details: [],
        },
      });
      expect(sessionCookieOf(response)).toBeUndefined();
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'LOGIN_FAILED' } });
      expect(audit.userId).toBe(users.ADMIN.id);
      expect(audit.after).toEqual({ email: USER_EMAILS.ADMIN, reason: 'WRONG_PASSWORD' });
    });

    test('rejects an unknown email with the same message and audits it without a user', async () => {
      const response = await request(app)
        .post(LOGIN_PATH)
        .send({ email: 'nobody@test.example', password: TEST_PASSWORD });
      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe('Email or password is incorrect');
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'LOGIN_FAILED' } });
      expect(audit).toMatchObject({ userId: null, entityId: 'nobody@test.example' });
      expect(audit.after.reason).toBe('UNKNOWN_EMAIL');
    });

    test('rejects an inactive user even with the right password', async () => {
      await prisma.user.update({ where: { id: users.PLANNER.id }, data: { isActive: false } });
      const response = await request(app)
        .post(LOGIN_PATH)
        .send({ email: USER_EMAILS.PLANNER, password: TEST_PASSWORD });
      expect(response.status).toBe(401);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'LOGIN_FAILED' } });
      expect(audit.after.reason).toBe('INACTIVE_USER');
    });

    test('never writes the password into the audit log', async () => {
      await request(app).post(LOGIN_PATH).send({ email: USER_EMAILS.ADMIN, password: 'wrong-one' });
      await request(app)
        .post(LOGIN_PATH)
        .send({ email: USER_EMAILS.ADMIN, password: TEST_PASSWORD });
      const audits = await prisma.auditLog.findMany();
      expect(JSON.stringify(audits)).not.toContain('wrong-one');
      expect(JSON.stringify(audits)).not.toContain(TEST_PASSWORD);
    });

    test('answers 422 with one detail per invalid field', async () => {
      const response = await request(app).post(LOGIN_PATH).send({ email: 'not-an-email' });
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.details.map((detail) => detail.field)).toEqual([
        'body.email',
        'body.password',
      ]);
    });

    test('answers 422 when there is no body at all', async () => {
      const response = await request(app).post(LOGIN_PATH);
      expect(response.status).toBe(422);
    });

    test('answers 400 for malformed JSON', async () => {
      const response = await request(app)
        .post(LOGIN_PATH)
        .set('Content-Type', 'application/json')
        .send('{"email": ');
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MALFORMED_REQUEST');
    });

    test('gives a new session id on every login to prevent session fixation', async () => {
      const agent = request.agent(app);
      const first = await agent
        .post(LOGIN_PATH)
        .send({ email: USER_EMAILS.ADMIN, password: TEST_PASSWORD });
      const second = await agent
        .post(LOGIN_PATH)
        .send({ email: USER_EMAILS.ADMIN, password: TEST_PASSWORD });
      expect(sessionCookieOf(first)).toBeDefined();
      expect(sessionCookieOf(second).split(';')[0]).not.toBe(sessionCookieOf(first).split(';')[0]);
      expect(await prisma.session.count()).toBe(1);
    });
  });

  describe('GET /auth/me', () => {
    test('answers 401 without a session', async () => {
      const response = await request(app).get(ME_PATH);
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('NOT_AUTHENTICATED');
    });

    test('returns a staff user without a company', async () => {
      const agent = await loginAs(app, USER_EMAILS.GATE_OPERATOR);
      const response = await agent.get(ME_PATH);
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ role: 'GATE_OPERATOR', company: null });
    });

    test('returns a customer with its company', async () => {
      const agent = await loginAs(app, USER_EMAILS.CUSTOMER);
      const response = await agent.get(ME_PATH);
      expect(response.body.data.company).toEqual({
        id: company.id,
        code: company.code,
        name: company.name,
      });
      expect(response.body.data).not.toHaveProperty('passwordHash');
    });

    test('ends the session of a user who was deactivated after logging in', async () => {
      const agent = await loginAs(app, USER_EMAILS.CUSTOMER);
      await prisma.user.update({ where: { id: users.CUSTOMER.id }, data: { isActive: false } });
      const response = await agent.get(ME_PATH);
      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe('Your session has ended, please log in again');
      expect(await prisma.session.count()).toBe(0);
    });
  });

  describe('POST /auth/logout', () => {
    test('ends the session, clears the cookie and writes a LOGOUT audit entry', async () => {
      const agent = await loginAs(app, USER_EMAILS.PLANNER);
      const response = await agent.post(LOGOUT_PATH);
      expect(response.status).toBe(204);
      expect(sessionCookieOf(response)).toContain('Expires=Thu, 01 Jan 1970');
      expect(await prisma.session.count()).toBe(0);
      expect(await prisma.auditLog.count({ where: { action: 'LOGOUT' } })).toBe(1);
      expect((await agent.get(ME_PATH)).status).toBe(401);
    });

    test('answers 401 without a session', async () => {
      expect((await request(app).post(LOGOUT_PATH)).status).toBe(401);
    });
  });
});
