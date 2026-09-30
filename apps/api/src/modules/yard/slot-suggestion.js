import { formatPositionCode, requiredBlockType, requiredSizeClass } from '@yardflow/shared';
import { stackAt, stackKey } from './stacks.js';

export const MAX_SUGGESTIONS = 3;
export const BASE_SCORE = 100;
export const PARTLY_FILLED_BONUS = 15;
export const SAME_OWNER_BONUS = 20;
export const HEIGHT_PENALTY_PER_TIER = 8;
export const ROW_SPACING_M = 3;
export const BAY_LENGTH_M = { SMALL: 7, LARGE: 13 };

function fittingBlocks(container, blocks) {
  const blockType = requiredBlockType(container);
  const sizeClass = requiredSizeClass(container);
  return blocks.filter((block) => block.type === blockType && block.sizeClass === sizeClass);
}

function listStacks(block, stacks) {
  const result = [];
  for (let row = 1; row <= block.rows; row += 1) {
    for (let bay = 1; bay <= block.bays; bay += 1) {
      result.push({ block, stack: stackAt(stacks, { blockCode: block.code, row, bay }) });
    }
  }
  return result;
}

function canTake(container, block, stack, excludedStacks) {
  return (
    !excludedStacks.has(stackKey(stack)) &&
    stack.height < block.maxTier &&
    (stack.height === 0 || stack.topSize === container.size)
  );
}

export function distanceToGate(block, { row, bay }) {
  return (
    block.gateDistanceM + (bay - 1) * BAY_LENGTH_M[block.sizeClass] + (row - 1) * ROW_SPACING_M
  );
}

function scoreStack(container, block, stack) {
  const isPartlyFilled = stack.height > 0;
  const hasSameOwnerBelow =
    isPartlyFilled &&
    container.ownerCompanyId !== undefined &&
    container.ownerCompanyId !== null &&
    stack.topOwnerCompanyId === container.ownerCompanyId;
  const distanceM = distanceToGate(block, stack);
  const tier = stack.height + 1;
  const score =
    BASE_SCORE +
    (isPartlyFilled ? PARTLY_FILLED_BONUS : 0) +
    (hasSameOwnerBelow ? SAME_OWNER_BONUS : 0) -
    HEIGHT_PENALTY_PER_TIER * stack.height -
    Math.floor(distanceM / 10);
  const reasons = [
    ...(hasSameOwnerBelow ? ['Same owner below'] : []),
    isPartlyFilled ? 'Partly filled' : 'Empty stack',
    `Tier ${tier} of ${block.maxTier}`,
    `${distanceM} m to gate`,
  ];
  return {
    blockCode: block.code,
    row: stack.row,
    bay: stack.bay,
    tier,
    positionCode: formatPositionCode({
      blockCode: block.code,
      row: stack.row,
      bay: stack.bay,
      tier,
    }),
    score,
    distanceM,
    reasons,
  };
}

function compareSuggestions(first, second) {
  return (
    second.score - first.score ||
    first.distanceM - second.distanceM ||
    first.blockCode.localeCompare(second.blockCode) ||
    first.row - second.row ||
    first.bay - second.bay
  );
}

export function suggestSlots({
  container,
  blocks,
  stacks,
  excludedStacks = new Set(),
  limit = MAX_SUGGESTIONS,
}) {
  return fittingBlocks(container, blocks)
    .flatMap((block) => listStacks(block, stacks))
    .filter(({ block, stack }) => canTake(container, block, stack, excludedStacks))
    .map(({ block, stack }) => scoreStack(container, block, stack))
    .sort(compareSuggestions)
    .slice(0, limit);
}
