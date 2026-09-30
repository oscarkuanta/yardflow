import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import {
  TEST_PASSWORD,
  USER_EMAILS,
  createUsersForAllRoles,
  resetDatabase,
  sessionCookieOf,
} from '../helpers/fixtures.js';
import { LOGIN_ATTEMPTS_PER_WINDOW } from '../../src/middleware/rate-limit.js';
import { TEST_WEB_ORIGIN, createTestContext } from '../helpers/test-app.js';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

describe('app basics', () => {
  const context = createTestContext();
  const { app } = context;

  afterAll(context.close);

  test('GET /health reports the database as up', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
    expect(Number.isInteger(response.body.uptimeSeconds)).toBe(true);
  });

  test('answers unknown routes with 404 in the standard error format', async () => {
    const response = await request(app).get('/api/v1/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'No route for GET /api/v1/does-not-exist',
        details: [],
      },
    });
  });

  test('sends security headers from helmet', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  test('allows credentialed CORS requests from the web origin only', async () => {
    const allowed = await request(app).get('/api/v1/health').set('Origin', TEST_WEB_ORIGIN);
    expect(allowed.headers['access-control-allow-origin']).toBe(TEST_WEB_ORIGIN);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    const other = await request(app).get('/api/v1/health').set('Origin', 'https://evil.example');
    expect(other.headers['access-control-allow-origin']).not.toBe('https://evil.example');
  });

  test('rejects a body larger than 100 kB', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.example', password: 'x'.repeat(200 * 1024) });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  describe('API docs', () => {
    test('serves Swagger UI', async () => {
      const response = await request(app).get('/api/docs/');
      expect(response.status).toBe(200);
      expect(response.text).toContain('swagger-ui');
    });

    test('serves the OpenAPI 3.1 document as JSON', async () => {
      const response = await request(app).get('/api/docs/openapi.json');
      expect(response.body.openapi).toBe('3.1.0');
      expect(response.body.servers).toEqual([{ url: '/api/v1' }]);
    });

    test('documents only routes that exist', async () => {
      const { body: document } = await request(app).get('/api/docs/openapi.json');
      const operations = Object.entries(document.paths).flatMap(([path, item]) =>
        HTTP_METHODS.filter((method) => item[method]).map((method) => [method, path]),
      );
      expect(operations.length).toBeGreaterThanOrEqual(17);
      for (const [method, path] of operations) {
        const response = await request(app)[method](`/api/v1${path}`);
        expect(response.body.error?.code).not.toBe('ROUTE_NOT_FOUND');
      }
    });
  });
});

describe('health check when the database is down', () => {
  const brokenPrisma = { $queryRaw: () => Promise.reject(new Error('Connection refused')) };
  const context = createTestContext({ prismaOverride: brokenPrisma });

  afterAll(context.close);

  test('answers 503 and reports the database as down', async () => {
    const response = await request(context.app).get('/api/v1/health');
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ status: 'error', database: 'down' });
  });
});

describe('production settings', () => {
  const context = createTestContext({ configOverrides: { NODE_ENV: 'production' } });

  beforeAll(async () => {
    await resetDatabase(context.prisma);
    await createUsersForAllRoles(context.prisma);
  });

  afterAll(context.close);

  test('trusts one proxy and sends a Secure cookie behind HTTPS', async () => {
    expect(context.app.get('trust proxy')).toBe(1);
    const response = await request(context.app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-Proto', 'https')
      .send({ email: USER_EMAILS.ADMIN, password: TEST_PASSWORD });
    expect(response.status).toBe(200);
    expect(sessionCookieOf(response)).toContain('Secure');
  });

  test('asks browsers to upgrade insecure requests', async () => {
    const response = await request(context.app).get('/api/v1/health');
    expect(response.headers['content-security-policy']).toContain('upgrade-insecure-requests');
  });
});

describe('login rate limit', () => {
  const context = createTestContext({ loginAttemptsPerWindow: LOGIN_ATTEMPTS_PER_WINDOW });

  beforeAll(async () => {
    await resetDatabase(context.prisma);
    await createUsersForAllRoles(context.prisma);
  });

  afterAll(context.close);

  test('allows 10 attempts per 15 minutes, then answers 429', async () => {
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const response = await request(context.app)
        .post('/api/v1/auth/login')
        .send({ email: USER_EMAILS.ADMIN, password: 'wrong-password' });
      expect(response.status).toBe(401);
    }
    const blocked = await request(context.app)
      .post('/api/v1/auth/login')
      .send({ email: USER_EMAILS.ADMIN, password: TEST_PASSWORD });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toEqual({
      code: 'RATE_LIMITED',
      message: 'Too many login attempts, please try again in 15 minutes',
      details: [],
    });
    expect(blocked.headers.ratelimit).toBeDefined();
  });
});
