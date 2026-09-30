import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { formatSeedReport, runSeed } from '../../prisma/seed/run-seed.js';
import { DEMO_PASSWORD, DEMO_PICKUP } from '../../prisma/seed/reference-data.js';
import { INSERT_ORDER } from '../../prisma/seed/write-dataset.js';

const FIXED_NOW = new Date('2026-09-30T08:20:00Z');
const FAST_BCRYPT_ROUNDS = 4;

describe('seed against the test database', () => {
  const prisma = new PrismaClient();
  let firstRun;
  let secondRun;

  beforeAll(async () => {
    firstRun = await runSeed(prisma, { now: FIXED_NOW, bcryptRounds: FAST_BCRYPT_ROUNDS });
    secondRun = await runSeed(prisma, { now: FIXED_NOW, bcryptRounds: FAST_BCRYPT_ROUNDS });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('can run twice and gives the same result', () => {
    expect(secondRun).toEqual(firstRun);
  });

  test('stores exactly the rows of the dataset, without duplicates from the first run', async () => {
    for (const [model, tableName] of INSERT_ORDER) {
      expect(await prisma[model].count()).toBe(firstRun.summary.rowCounts[tableName]);
    }
  });

  test('stores bcrypt hashes, never the plain password or PIN', async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@yardflow.dev' } });
    expect(admin.passwordHash).not.toBe(DEMO_PASSWORD);
    expect(await bcrypt.compare(DEMO_PASSWORD, admin.passwordHash)).toBe(true);

    const pickup = await prisma.preAdvice.findUniqueOrThrow({
      where: { reference: firstRun.demo.pickup.reference },
    });
    expect(await bcrypt.compare(DEMO_PICKUP.pin, pickup.pinHash)).toBe(true);
  });

  test('keeps the demo pickup container under 2 others in block B', async () => {
    const container = await prisma.container.findUniqueOrThrow({
      where: { number: DEMO_PICKUP.containerNumber },
      include: { position: { include: { block: true } } },
    });
    const stackHeight = await prisma.containerPosition.count({
      where: {
        blockId: container.position.blockId,
        row: container.position.row,
        bay: container.position.bay,
      },
    });
    expect(container.position.block.code).toBe('B');
    expect(container.position.tier).toBe(1);
    expect(stackHeight).toBe(3);
  });

  test('prints the demo logins and the pickup PIN', () => {
    const report = formatSeedReport(firstRun);
    expect(report).toContain('admin@yardflow.dev');
    expect(report).toContain('ops@nordtrans.example');
    expect(report).toContain(DEMO_PICKUP.pin);
    expect(report).toContain('HNFU 204571 1');
  });
});
