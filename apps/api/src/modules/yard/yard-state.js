import { Prisma } from '@prisma/client';
import { buildStacks, stackAt } from './stacks.js';

export const STACK_CONTAINER_SELECT = {
  id: true,
  number: true,
  size: true,
  isHighCube: true,
  loadStatus: true,
  isDangerous: true,
  imoClass: true,
  grossWeightKg: true,
  ownerCompanyId: true,
  gateInAt: true,
};

export async function loadYard(client) {
  const [blocks, positions] = await Promise.all([
    client.block.findMany({ orderBy: { code: 'asc' } }),
    client.containerPosition.findMany({
      include: { container: { select: STACK_CONTAINER_SELECT } },
    }),
  ]);
  return { blocks, stacks: buildStacks(blocks, positions) };
}

export async function loadStack(client, block, { row, bay }) {
  const positions = await client.containerPosition.findMany({
    where: { blockId: block.id, row, bay },
    include: { container: { select: STACK_CONTAINER_SELECT } },
  });
  return stackAt(buildStacks([block], positions), { blockCode: block.code, row, bay });
}

export async function lockBlocks(transaction, blockIds) {
  const uniqueIds = [...new Set(blockIds)].sort((first, second) => first - second);
  await transaction.$queryRaw`SELECT id FROM Block WHERE id IN (${Prisma.join(uniqueIds)}) ORDER BY id FOR UPDATE`;
}

export async function activeHoldContainerIds(client, containerIds) {
  const holds = await client.customsHold.findMany({
    where: { releasedAt: null, ...(containerIds && { containerId: { in: containerIds } }) },
    select: { containerId: true },
  });
  return new Set(holds.map((hold) => hold.containerId));
}

export const POSITION_WRITE_TRANSACTION = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
};
