import { PrismaClient } from '@prisma/client';
import { clockFromStart } from '../src/lib/clock.js';
import { formatSeedReport, runSeed } from './seed/run-seed.js';

const prisma = new PrismaClient();
const clock = clockFromStart(process.env.DEMO_CLOCK_START);

try {
  const result = await runSeed(prisma, { now: clock() });
  console.log(formatSeedReport(result));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
