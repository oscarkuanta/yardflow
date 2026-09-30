import bcrypt from 'bcrypt';
import request from 'supertest';
import { clearDatabase } from '../../prisma/seed/write-dataset.js';

export const TEST_PASSWORD = 'correct-horse-42';
const FAST_BCRYPT_ROUNDS = 4;
const TEST_PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, FAST_BCRYPT_ROUNDS);

export const USER_EMAILS = {
  ADMIN: 'admin@test.example',
  PLANNER: 'planner@test.example',
  GATE_OPERATOR: 'gate@test.example',
  CUSTOMER: 'customer@test.example',
};

export async function resetDatabase(prisma) {
  await clearDatabase(prisma);
}

export async function createCompany(prisma, overrides = {}) {
  return prisma.company.create({
    data: { code: 'TST', name: 'Test Freight', contactEmail: 'ops@test.example', ...overrides },
  });
}

export async function createUser(prisma, { role, email, companyId = null, isActive = true }) {
  return prisma.user.create({
    data: {
      email,
      name: `Test ${role.toLowerCase()}`,
      passwordHash: TEST_PASSWORD_HASH,
      role,
      companyId,
      isActive,
    },
  });
}

export async function createUsersForAllRoles(prisma) {
  const company = await createCompany(prisma);
  const users = {};
  for (const [role, email] of Object.entries(USER_EMAILS)) {
    const companyId = role === 'CUSTOMER' ? company.id : null;
    users[role] = await createUser(prisma, { role, email, companyId });
  }
  return { company, users };
}

export async function loginAs(app, email, password = TEST_PASSWORD) {
  const agent = request.agent(app);
  const response = await agent.post('/api/v1/auth/login').send({ email, password });
  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.status}`);
  }
  return agent;
}

export function sessionCookieOf(response) {
  return (response.headers['set-cookie'] ?? []).find((cookie) =>
    cookie.startsWith('yardflow.sid='),
  );
}
