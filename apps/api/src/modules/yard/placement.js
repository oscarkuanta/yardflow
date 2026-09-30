import { formatPositionCode } from '@yardflow/shared';
import { conflict, validationFailed } from '../../lib/errors.js';
import { isUniqueViolation, isWriteConflict } from '../../lib/prisma-errors.js';
import { stackingProblems } from './stacking-rules.js';
import { loadStack, lockBlocks } from './yard-state.js';

export function slotTaken() {
  return conflict('SLOT_TAKEN', 'Slot was just taken, please pick another');
}

export function containerBlocked(blockerCount) {
  const noun = blockerCount === 1 ? 'container' : 'containers';
  return conflict('CONTAINER_BLOCKED', `Container is blocked by ${blockerCount} ${noun} above it`);
}

export function stackingRuleBroken(problems) {
  return conflict(
    'STACKING_RULE_BROKEN',
    problems.map((problem) => problem.message).join('; '),
    problems,
  );
}

export function positionCodeOf(position) {
  return formatPositionCode({
    blockCode: position.block.code,
    row: position.row,
    bay: position.bay,
    tier: position.tier,
  });
}

async function writePosition(write) {
  try {
    await write();
  } catch (error) {
    if (isUniqueViolation(error) || isWriteConflict(error)) {
      throw slotTaken();
    }
    throw error;
  }
}

function topPositionCode(block, stack) {
  return formatPositionCode({
    blockCode: block.code,
    row: stack.row,
    bay: stack.bay,
    tier: stack.height + 1,
  });
}

export async function moveToStackTop(transaction, { container, block, stack, type, userId, at }) {
  const toPosition = topPositionCode(block, stack);
  await writePosition(() =>
    transaction.containerPosition.update({
      where: { containerId: container.id },
      data: { blockId: block.id, row: stack.row, bay: stack.bay, tier: stack.height + 1 },
    }),
  );
  await transaction.movement.create({
    data: {
      containerId: container.id,
      type,
      fromPosition: positionCodeOf(container.position),
      toPosition,
      userId,
      createdAt: at,
    },
  });
  return toPosition;
}

export async function placeArrivingContainer(
  transaction,
  { container, target, type, userId, at, field = 'body.to' },
) {
  const block = await transaction.block.findUnique({ where: { code: target.blockCode } });
  if (!block) {
    throw validationFailed([{ field, message: `Block ${target.blockCode} does not exist` }]);
  }
  await lockBlocks(transaction, [block.id]);
  const stack = await loadStack(transaction, block, target);
  const problems = stackingProblems({ container, block, stack, tier: target.tier });
  if (problems.length > 0) {
    throw stackingRuleBroken(problems);
  }
  const toPosition = topPositionCode(block, stack);
  await writePosition(() =>
    transaction.containerPosition.create({
      data: {
        containerId: container.id,
        blockId: block.id,
        row: stack.row,
        bay: stack.bay,
        tier: stack.height + 1,
      },
    }),
  );
  await transaction.movement.create({
    data: { containerId: container.id, type, toPosition, userId, createdAt: at },
  });
  return toPosition;
}

export function yardChanges(containerNumber, fromPosition, toPosition) {
  return {
    changes: [
      ...(fromPosition ? [{ positionCode: fromPosition, containerNumber, action: 'REMOVED' }] : []),
      ...(toPosition ? [{ positionCode: toPosition, containerNumber, action: 'PLACED' }] : []),
    ],
  };
}
