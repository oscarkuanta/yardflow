import { formatStackCode, requiredBlockType, requiredSizeClass } from '@yardflow/shared';

const SIZE_LABELS = { FT20: '20 ft', FT40: '40 ft', FT45: '45 ft' };
const BLOCK_TYPE_RULES = {
  DG: 'Dangerous goods go only to DG blocks',
  EMPTY: 'Empty containers go only to EMPTY blocks',
  STANDARD: 'Full containers go only to STANDARD blocks',
};

export function sizeLabel(size) {
  return SIZE_LABELS[size];
}

function blockTypeProblem(container, block) {
  const neededType = requiredBlockType(container);
  if (neededType === block.type) {
    return null;
  }
  return {
    rule: 'BLOCK_TYPE',
    message: `${BLOCK_TYPE_RULES[neededType]}, block ${block.code} is ${block.type}`,
  };
}

function sizeClassProblem(container, block) {
  const neededClass = requiredSizeClass(container);
  if (neededClass === block.sizeClass) {
    return null;
  }
  return {
    rule: 'SIZE_CLASS',
    message: `A ${sizeLabel(container.size)} container needs a ${neededClass} block, block ${block.code} is ${block.sizeClass}`,
  };
}

function boundsProblem(block, { row, bay }) {
  if (row >= 1 && row <= block.rows && bay >= 1 && bay <= block.bays) {
    return null;
  }
  return {
    rule: 'OUT_OF_BLOCK',
    message: `Block ${block.code} has rows 1 to ${block.rows} and bays 1 to ${block.bays}`,
  };
}

function heightProblem(block, stack) {
  if (stack.height < block.maxTier) {
    return null;
  }
  return {
    rule: 'STACK_FULL',
    message: `Stack ${formatStackCode(stack)} is full (${stack.height} of ${block.maxTier} tiers)`,
  };
}

function topSizeProblem(container, stack) {
  if (stack.height === 0 || stack.topSize === container.size) {
    return null;
  }
  return {
    rule: 'SIZE_ON_TOP',
    message: `A ${sizeLabel(container.size)} container cannot sit on a ${sizeLabel(stack.topSize)} container`,
  };
}

function tierProblem(stack, tier) {
  const nextTier = stack.height + 1;
  if (tier === null || tier === undefined || tier === nextTier) {
    return null;
  }
  return {
    rule: 'TIER',
    message: `The next free tier on ${formatStackCode(stack)} is ${nextTier}, not ${tier}`,
  };
}

export function stackingProblems({ container, block, stack, tier = null }) {
  const outOfBlock = boundsProblem(block, stack);
  if (outOfBlock) {
    return [outOfBlock];
  }
  return [
    blockTypeProblem(container, block),
    sizeClassProblem(container, block),
    heightProblem(block, stack),
    topSizeProblem(container, stack),
    tierProblem(stack, tier),
  ].filter(Boolean);
}
