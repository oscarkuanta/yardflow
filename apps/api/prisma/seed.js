import { PrismaClient } from '@prisma/client';
import { formatSeedReport, runSeed } from './seed/run-seed.js';

const prisma = new PrismaClient();

try {
  const result = await runSeed(prisma);
  console.log(formatSeedReport(result));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
