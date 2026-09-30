const LARGE_STACK_FT45_PROBABILITY = 0.15;

export function stackKey({ blockCode, row, bay }) {
  return `${blockCode}-${row}-${bay}`;
}

function listEmptyStacks(block) {
  const stacks = [];
  for (let row = 1; row <= block.rows; row += 1) {
    for (let bay = 1; bay <= block.bays; bay += 1) {
      stacks.push({ blockCode: block.code, row, bay, size: null, height: 0, reserved: false });
    }
  }
  return stacks;
}

function chooseStackSize(random, block) {
  if (block.sizeClass === 'SMALL') {
    return 'FT20';
  }
  return random.chance(LARGE_STACK_FT45_PROBABILITY) ? 'FT45' : 'FT40';
}

export function blockSlotCount(block) {
  return block.rows * block.bays * block.maxTier;
}

function reserveStack(stacks, reservation) {
  const stack = stacks.find(
    (candidate) => candidate.row === reservation.row && candidate.bay === reservation.bay,
  );
  stack.size = reservation.size;
  stack.height = reservation.height;
  stack.reserved = true;
  return reservation.height;
}

function fillBlock(random, block, targetOccupancy, reservation) {
  const stacks = listEmptyStacks(block);
  const targetCount = Math.round(blockSlotCount(block) * targetOccupancy);
  let placedCount = reservation ? reserveStack(stacks, reservation) : 0;
  while (placedCount < targetCount) {
    const openStacks = stacks.filter((stack) => !stack.reserved && stack.height < block.maxTier);
    const stack = random.pick(openStacks);
    if (stack.height === 0) {
      stack.size = chooseStackSize(random, block);
    }
    stack.height += 1;
    placedCount += 1;
  }
  return stacks;
}

export function buildYardLayout(random, blocks, { targetOccupancy, reservedStack = null }) {
  return blocks.flatMap((block) =>
    fillBlock(
      random,
      block,
      targetOccupancy,
      reservedStack?.blockCode === block.code ? reservedStack : null,
    ),
  );
}

export function listSlots(stacks) {
  return stacks.flatMap((stack) =>
    Array.from({ length: stack.height }, (_, index) => ({ stack, tier: index + 1 })),
  );
}
