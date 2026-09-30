import { generateContainerNumber } from '@yardflow/shared';
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

export async function loginAllRoles(app) {
  const agents = {};
  for (const [role, email] of Object.entries(USER_EMAILS)) {
    agents[role] = await loginAs(app, email);
  }
  return agents;
}

export async function createBlock(prisma, overrides = {}) {
  return prisma.block.create({
    data: {
      code: 'B',
      type: 'STANDARD',
      sizeClass: 'LARGE',
      rows: 5,
      bays: 10,
      maxTier: 5,
      mapX: 180,
      mapY: 20,
      gateDistanceM: 40,
      ...overrides,
    },
  });
}

let nextSerial = 1;

export function nextContainerNumber() {
  return generateContainerNumber('TSTU', nextSerial++);
}

export async function createContainer(prisma, { companyId, state = 'IN_YARD', ...attributes }) {
  return prisma.container.create({
    data: {
      number: nextContainerNumber(),
      size: 'FT40',
      loadStatus: 'FULL',
      ownerCompanyId: companyId,
      state,
      gateInAt: state === 'EXPECTED' ? null : new Date(),
      ...attributes,
    },
  });
}

export async function placeContainer(prisma, { block, row, bay, tier, ...attributes }) {
  const container = await createContainer(prisma, attributes);
  await prisma.containerPosition.create({
    data: { containerId: container.id, blockId: block.id, row, bay, tier },
  });
  return container;
}

export async function createSmallYard(prisma) {
  const geometry = { rows: 2, bays: 3, maxTier: 3, mapX: 0, mapY: 0 };
  return {
    A: await createBlock(prisma, {
      ...geometry,
      code: 'A',
      sizeClass: 'SMALL',
      gateDistanceM: 10,
    }),
    B: await createBlock(prisma, { ...geometry, code: 'B', gateDistanceM: 40 }),
    E: await createBlock(prisma, {
      ...geometry,
      code: 'E',
      type: 'EMPTY',
      rows: 1,
      bays: 2,
      gateDistanceM: 80,
    }),
    X: await createBlock(prisma, {
      ...geometry,
      code: 'X',
      type: 'DG',
      sizeClass: 'SMALL',
      rows: 1,
      bays: 2,
      maxTier: 2,
      gateDistanceM: 90,
    }),
  };
}

export async function createHold(prisma, { containerId, placedById, releasedAt = null }) {
  return prisma.customsHold.create({
    data: {
      containerId,
      reason: 'X-ray inspection requested',
      placedById,
      releasedById: releasedAt ? placedById : null,
      releasedAt,
    },
  });
}

export function recordEvents(eventBus, eventNames) {
  const received = [];
  for (const eventName of eventNames) {
    eventBus.subscribe(eventName, (payload) => received.push({ eventName, payload }));
  }
  return received;
}

export async function createTariffs(prisma) {
  const baseRates = { FT20: 900, FT40: 1500, FT45: 1700 };
  await prisma.tariff.createMany({
    data: Object.entries(baseRates).flatMap(([size, rate]) => [
      { size, isDangerous: false, freeDays: 5, dailyRateCents: rate },
      { size, isDangerous: true, freeDays: 3, dailyRateCents: rate * 2 },
    ]),
  });
}

export async function createPreAdvice(prisma, { companyId, timeSlotId, status = 'ACTIVE' }) {
  return prisma.preAdvice.create({
    data: {
      reference: `PA-TEST-${nextSerial++}`,
      companyId,
      type: 'PICKUP',
      containerNumber: generateContainerNumber('TSTU', nextSerial++),
      truckPlate: 'HH-TS 1',
      driverName: 'Test Driver',
      pinHash: TEST_PASSWORD_HASH,
      timeSlotId,
      status,
    },
  });
}

export function sessionCookieOf(response) {
  return (response.headers['set-cookie'] ?? []).find((cookie) =>
    cookie.startsWith('yardflow.sid='),
  );
}
