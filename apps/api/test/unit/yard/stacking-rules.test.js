import { describe, expect, test } from '@jest/globals';
import { stackingProblems } from '../../../src/modules/yard/stacking-rules.js';
import { buildStacks, emptyStack, stackAt } from '../../../src/modules/yard/stacks.js';

const blockB = { code: 'B', type: 'STANDARD', sizeClass: 'LARGE', rows: 5, bays: 10, maxTier: 5 };
const full40 = { size: 'FT40', loadStatus: 'FULL', isDangerous: false };

function stack(height, topSize = 'FT40') {
  return { blockCode: 'B', row: 2, bay: 5, height, topSize: height ? topSize : null };
}

describe('stackingProblems (spec 6.3)', () => {
  test('accepts a valid placement', () => {
    expect(
      stackingProblems({ container: full40, block: blockB, stack: stack(1), tier: 2 }),
    ).toEqual([]);
  });

  test.each([
    [
      { ...full40, isDangerous: true },
      blockB,
      'Dangerous goods go only to DG blocks, block B is STANDARD',
    ],
    [
      { ...full40, loadStatus: 'EMPTY' },
      blockB,
      'Empty containers go only to EMPTY blocks, block B is STANDARD',
    ],
    [
      full40,
      { ...blockB, type: 'EMPTY' },
      'Full containers go only to STANDARD blocks, block B is EMPTY',
    ],
  ])('names the block type rule for %j in %j', (container, block, message) => {
    const problems = stackingProblems({ container, block, stack: stack(0) });
    expect(problems[0]).toEqual({ rule: 'BLOCK_TYPE', message });
  });

  test('names the size class rule', () => {
    const problems = stackingProblems({
      container: { ...full40, size: 'FT20' },
      block: blockB,
      stack: stack(0),
    });
    expect(problems).toEqual([
      {
        rule: 'SIZE_CLASS',
        message: 'A 20 ft container needs a SMALL block, block B is LARGE',
      },
    ]);
  });

  test('refuses a full stack', () => {
    expect(stackingProblems({ container: full40, block: blockB, stack: stack(5) })).toEqual([
      { rule: 'STACK_FULL', message: 'Stack B-02-05 is full (5 of 5 tiers)' },
    ]);
  });

  test('refuses a different size on top', () => {
    expect(
      stackingProblems({ container: { ...full40, size: 'FT45' }, block: blockB, stack: stack(2) }),
    ).toEqual([
      { rule: 'SIZE_ON_TOP', message: 'A 45 ft container cannot sit on a 40 ft container' },
    ]);
  });

  test.each([1, 4])(
    'refuses tier %i when the next free tier is 3 (no gaps, nothing under)',
    (tier) => {
      expect(stackingProblems({ container: full40, block: blockB, stack: stack(2), tier })).toEqual(
        [{ rule: 'TIER', message: `The next free tier on B-02-05 is 3, not ${tier}` }],
      );
    },
  );

  test('refuses a row or bay outside the block and stops there', () => {
    expect(
      stackingProblems({ container: full40, block: blockB, stack: { ...stack(0), bay: 11 } }),
    ).toEqual([{ rule: 'OUT_OF_BLOCK', message: 'Block B has rows 1 to 5 and bays 1 to 10' }]);
    expect(
      stackingProblems({ container: full40, block: blockB, stack: { ...stack(0), row: 0 } })[0]
        .rule,
    ).toBe('OUT_OF_BLOCK');
  });
});

describe('buildStacks', () => {
  test('groups positions by stack, orders them bottom up and describes the top', () => {
    const blocks = [{ id: 1, code: 'B' }];
    const positions = [
      {
        blockId: 1,
        row: 1,
        bay: 1,
        tier: 2,
        container: { id: 20, size: 'FT40', ownerCompanyId: 9 },
      },
      {
        blockId: 1,
        row: 1,
        bay: 1,
        tier: 1,
        container: { id: 10, size: 'FT40', ownerCompanyId: 3 },
      },
    ];
    const stack = stackAt(buildStacks(blocks, positions), { blockCode: 'B', row: 1, bay: 1 });
    expect(stack).toMatchObject({ height: 2, topSize: 'FT40', topOwnerCompanyId: 9 });
    expect(stack.containers.map((container) => container.id)).toEqual([10, 20]);
  });

  test('returns an empty stack for an address without containers', () => {
    expect(stackAt(new Map(), { blockCode: 'A', row: 1, bay: 2 })).toEqual(
      emptyStack({ blockCode: 'A', row: 1, bay: 2 }),
    );
  });
});
