import { formatPositionCode } from '@yardflow/shared';
import { conflict } from '../../lib/errors.js';
import { isUniqueViolation, isWriteConflict } from '../../lib/prisma-errors.js';

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

export async function moveToStackTop(transaction, { container, block, stack, type, userId, at }) {
  const tier = stack.height + 1;
  const toPosition = formatPositionCode({
    blockCode: block.code,
    row: stack.row,
    bay: stack.bay,
    tier,
  });
  try {
    await transaction.containerPosition.update({
      where: { containerId: container.id },
      data: { blockId: block.id, row: stack.row, bay: stack.bay, tier },
    });
  } catch (error) {
    if (isUniqueViolation(error) || isWriteConflict(error)) {
      throw slotTaken();
    }
    throw error;
  }
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

export function yardChanges(containerNumber, fromPosition, toPosition) {
  return {
    changes: [
      { positionCode: fromPosition, containerNumber, action: 'REMOVED' },
      { positionCode: toPosition, containerNumber, action: 'PLACED' },
    ],
  };
}
