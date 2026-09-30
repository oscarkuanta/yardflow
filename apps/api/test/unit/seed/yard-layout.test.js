import { describe, expect, test } from '@jest/globals';
import { createRandom } from '../../../prisma/seed/random.js';
import { BLOCKS } from '../../../prisma/seed/reference-data.js';
import {
  blockSlotCount,
  buildYardLayout,
  listSlots,
  stackKey,
} from '../../../prisma/seed/yard-layout.js';

const RESERVED_STACK = { blockCode: 'B', row: 2, bay: 3, size: 'FT40', height: 3 };

function buildLayout(seed = 1) {
  return buildYardLayout(createRandom(seed), BLOCKS, {
    targetOccupancy: 0.65,
    reservedStack: RESERVED_STACK,
  });
}

describe('buildYardLayout', () => {
  const stacks = buildLayout();

  test('lists every stack of every block, including empty ones', () => {
    const expectedCount = BLOCKS.reduce((sum, block) => sum + block.rows * block.bays, 0);
    expect(stacks).toHaveLength(expectedCount);
    expect(new Set(stacks.map(stackKey)).size).toBe(expectedCount);
  });

  test.each(BLOCKS.map((block) => [block.code, block]))(
    'fills block %s to 65 percent of its slots',
    (code, block) => {
      const placed = stacks
        .filter((stack) => stack.blockCode === code)
        .reduce((sum, stack) => sum + stack.height, 0);
      expect(placed).toBe(Math.round(blockSlotCount(block) * 0.65));
    },
  );

  test('never stacks above the maximum tier', () => {
    for (const stack of stacks) {
      const block = BLOCKS.find((candidate) => candidate.code === stack.blockCode);
      expect(stack.height).toBeLessThanOrEqual(block.maxTier);
    }
  });

  test('uses only 20 ft in SMALL blocks and only 40 ft or 45 ft in LARGE blocks', () => {
    for (const stack of stacks.filter((candidate) => candidate.height > 0)) {
      const block = BLOCKS.find((candidate) => candidate.code === stack.blockCode);
      const allowedSizes = block.sizeClass === 'SMALL' ? ['FT20'] : ['FT40', 'FT45'];
      expect(allowedSizes).toContain(stack.size);
    }
  });

  test('keeps the reserved stack exactly as requested', () => {
    const reserved = stacks.filter((stack) => stack.reserved);
    expect(reserved).toHaveLength(1);
    expect(reserved[0]).toMatchObject({ blockCode: 'B', row: 2, bay: 3, size: 'FT40', height: 3 });
  });

  test('is the same for the same seed', () => {
    expect(buildLayout(1)).toEqual(buildLayout(1));
  });

  test('works without a reserved stack', () => {
    const layout = buildYardLayout(createRandom(2), BLOCKS, { targetOccupancy: 0.5 });
    expect(layout.some((stack) => stack.reserved)).toBe(false);
  });
});

describe('listSlots', () => {
  test('returns one slot per tier, numbered from 1', () => {
    const stack = { blockCode: 'A', row: 1, bay: 1, size: 'FT20', height: 3 };
    expect(listSlots([stack]).map((slot) => slot.tier)).toEqual([1, 2, 3]);
  });
});
