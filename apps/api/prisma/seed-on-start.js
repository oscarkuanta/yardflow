import { PrismaClient } from '@prisma/client';
import { clockFromStart } from '../src/lib/clock.js';
import { formatSeedReport, runSeed } from './seed/run-seed.js';
import { shouldSeed } from './seed/seed-on-start.js';

const prisma = new PrismaClient();
const mode = process.env.SEED_ON_START ?? 'if-empty';

try {
  const userCount = await prisma.user.count();
  if (shouldSeed(mode, userCount)) {
    const result = await runSeed(prisma, { now: clockFromStart(process.env.DEMO_CLOCK_START)() });
    console.log(formatSeedReport(result));
  } else {
    console.log(`Seed skipped (SEED_ON_START=${mode}, ${userCount} users found).`);
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
