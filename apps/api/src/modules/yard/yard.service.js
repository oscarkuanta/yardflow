import { formatPositionCode, formatStackCode } from '@yardflow/shared';
import { conflict, notFound, validationFailed } from '../../lib/errors.js';
import { YARD_CHANGED } from '../../lib/event-bus.js';
import { describeOccupancy } from '../blocks/block-geometry.js';
import {
  containerBlocked,
  moveToStackTop,
  positionCodeOf,
  stackingRuleBroken,
  yardChanges,
} from './placement.js';
import { suggestSlots } from './slot-suggestion.js';
import { stackingProblems } from './stacking-rules.js';
import { stackAt, stackKey } from './stacks.js';
import {
  activeHoldContainerIds,
  loadStack,
  loadYard,
  lockBlocks,
  POSITION_WRITE_TRANSACTION,
} from './yard-state.js';

export function noFreeSlot() {
  return conflict('NO_FREE_SLOT', 'No free slot for this container type');
}

function mapStack(stack, heldContainerIds) {
  return {
    row: stack.row,
    bay: stack.bay,
    stackCode: formatStackCode(stack),
    height: stack.height,
    topSize: stack.topSize,
    hasHold: stack.containers.some((container) => heldContainerIds.has(container.id)),
    hasDangerous: stack.containers.some((container) => container.isDangerous),
  };
}

function mapBlock(block, stacks, heldContainerIds) {
  const blockStacks = [];
  for (let row = 1; row <= block.rows; row += 1) {
    for (let bay = 1; bay <= block.bays; bay += 1) {
      blockStacks.push(stackAt(stacks, { blockCode: block.code, row, bay }));
    }
  }
  const usedSlots = blockStacks.reduce((sum, stack) => sum + stack.height, 0);
  return {
    ...block,
    occupancy: describeOccupancy(block, usedSlots),
    stacks: blockStacks.map((stack) => mapStack(stack, heldContainerIds)),
  };
}

function presentStackContainer(container, heldContainerIds) {
  return {
    number: container.number,
    size: container.size,
    isHighCube: container.isHighCube,
    loadStatus: container.loadStatus,
    isDangerous: container.isDangerous,
    imoClass: container.imoClass,
    grossWeightKg: container.grossWeightKg,
    gateInAt: container.gateInAt,
    owner: container.ownerCompany,
    hasHold: heldContainerIds.has(container.id),
  };
}

export function createYardService({ prisma, auditService, eventBus, clock }) {
  async function findBlockOrThrow(client, code, toError) {
    const block = await client.block.findUnique({ where: { code } });
    if (!block) {
      throw toError();
    }
    return block;
  }

  async function getMap() {
    const { blocks, stacks } = await loadYard(prisma);
    const heldContainerIds = await activeHoldContainerIds(prisma);
    return blocks.map((block) => mapBlock(block, stacks, heldContainerIds));
  }

  async function getStack({ block: blockCode, row, bay }) {
    const block = await findBlockOrThrow(prisma, blockCode, () => notFound('Stack not found'));
    if (row > block.rows || bay > block.bays) {
      throw notFound('Stack not found');
    }
    const positions = await prisma.containerPosition.findMany({
      where: { blockId: block.id, row, bay },
      orderBy: { tier: 'asc' },
      include: {
        container: { include: { ownerCompany: { select: { id: true, code: true, name: true } } } },
      },
    });
    const heldContainerIds = await activeHoldContainerIds(
      prisma,
      positions.map((position) => position.containerId),
    );
    return {
      blockCode: block.code,
      row,
      bay,
      stackCode: formatStackCode({ blockCode: block.code, row, bay }),
      maxTier: block.maxTier,
      height: positions.length,
      tiers: positions.map((position) => ({
        tier: position.tier,
        positionCode: formatPositionCode({ blockCode: block.code, row, bay, tier: position.tier }),
        container: presentStackContainer(position.container, heldContainerIds),
      })),
    };
  }

  async function suggest(attributes) {
    const { blocks, stacks } = await loadYard(prisma);
    const suggestions = suggestSlots({ container: attributes, blocks, stacks });
    if (suggestions.length === 0) {
      throw noFreeSlot();
    }
    const maxTierByBlock = new Map(blocks.map((block) => [block.code, block.maxTier]));
    return suggestions.map((suggestion) => ({
      ...suggestion,
      maxTier: maxTierByBlock.get(suggestion.blockCode),
    }));
  }

  async function findMovableContainer(transaction, number) {
    const container = await transaction.container.findUnique({
      where: { number },
      include: { position: { include: { block: true } } },
    });
    if (!container) {
      throw notFound('Container not found');
    }
    if (container.state !== 'IN_YARD' || !container.position) {
      throw conflict('CONTAINER_NOT_IN_YARD', 'Only containers in the yard can be moved');
    }
    return container;
  }

  async function move({ containerNumber, to }, actor) {
    const result = await prisma.$transaction(async (transaction) => {
      const container = await findMovableContainer(transaction, containerNumber);
      const source = container.position;
      const targetBlock = await findBlockOrThrow(transaction, to.blockCode, () =>
        validationFailed([{ field: 'body.to', message: `Block ${to.blockCode} does not exist` }]),
      );
      const sourceAddress = { blockCode: source.block.code, row: source.row, bay: source.bay };
      if (stackKey(sourceAddress) === stackKey(to)) {
        throw conflict('SAME_STACK', `The container is already in stack ${formatStackCode(to)}`);
      }
      await lockBlocks(transaction, [source.blockId, targetBlock.id]);
      const sourceStack = await loadStack(transaction, source.block, source);
      const blockerCount = sourceStack.height - source.tier;
      if (blockerCount > 0) {
        throw containerBlocked(blockerCount);
      }
      const targetStack = await loadStack(transaction, targetBlock, to);
      const problems = stackingProblems({
        container,
        block: targetBlock,
        stack: targetStack,
        tier: to.tier,
      });
      if (problems.length > 0) {
        throw stackingRuleBroken(problems);
      }
      const fromPosition = positionCodeOf(source);
      const toPosition = await moveToStackTop(transaction, {
        container,
        block: targetBlock,
        stack: targetStack,
        type: 'YARD_MOVE',
        userId: actor.id,
        at: clock(),
      });
      await auditService.record(
        {
          userId: actor.id,
          action: 'MOVE',
          entity: 'Container',
          entityId: container.number,
          before: { positionCode: fromPosition },
          after: { positionCode: toPosition },
          ip: actor.ip,
        },
        transaction,
      );
      return { containerNumber: container.number, fromPosition, toPosition };
    }, POSITION_WRITE_TRANSACTION);
    eventBus.publish(
      YARD_CHANGED,
      yardChanges(result.containerNumber, result.fromPosition, result.toPosition),
    );
    return result;
  }

  return { getMap, getStack, suggest, move };
}
