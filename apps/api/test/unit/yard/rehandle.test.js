import { describe, expect, test } from '@jest/globals';
import { planBlockers, planRelocationDestinations } from '../../../src/modules/yard/rehandle.js';
import { describeStack, stackKey } from '../../../src/modules/yard/stacks.js';

function stackOf(height) {
  return Array.from({ length: height }, (_, index) => ({
    id: index + 1,
    number: `TIER${index + 1}`,
    tier: index + 1,
    size: 'FT40',
    loadStatus: 'FULL',
    isDangerous: false,
    ownerCompanyId: 1,
  }));
}

describe('planBlockers (spec 8.3)', () => {
  test('target at tier 1 in a stack of 3 has two blockers, tier 3 first', () => {
    const stack = stackOf(3);
    const blockers = planBlockers(stack[0], stack);
    expect(blockers.map((blocker) => [blocker.tier, blocker.sequence])).toEqual([
      [3, 1],
      [2, 2],
    ]);
  });

  test('target on top has no blockers', () => {
    const stack = stackOf(3);
    expect(planBlockers(stack[2], stack)).toEqual([]);
  });

  test('target at tier 2 in a stack of 2 has no blockers', () => {
    const stack = stackOf(2);
    expect(planBlockers(stack[1], stack)).toEqual([]);
  });
});

describe('planRelocationDestinations (spec 8.3)', () => {
  const sourceAddress = { blockCode: 'B', row: 1, bay: 1 };
  const blockB = {
    code: 'B',
    type: 'STANDARD',
    sizeClass: 'LARGE',
    rows: 1,
    bays: 3,
    maxTier: 5,
    gateDistanceM: 40,
  };

  function plan({ blocks = [blockB], stackHeight = 4, targetTier = 1 } = {}) {
    const containers = stackOf(stackHeight);
    const stacks = new Map([[stackKey(sourceAddress), describeStack(sourceAddress, containers)]]);
    const blockers = planBlockers(containers[targetTier - 1], containers);
    return planRelocationDestinations({ blockers, blocks, stacks, sourceStack: sourceAddress });
  }

  test('never picks the source stack', () => {
    for (const { destination } of plan()) {
      expect(stackKey(destination)).not.toBe(stackKey(sourceAddress));
    }
  });

  test('never gives two blockers the same destination tier', () => {
    const destinations = plan().map(({ destination }) => destination.positionCode);
    expect(destinations).toHaveLength(3);
    expect(new Set(destinations).size).toBe(3);
  });

  test('stacks later blockers on top of earlier ones when that stack is still the best', () => {
    const destinations = plan({ stackHeight: 3 }).map(
      ({ destination }) => destination.positionCode,
    );
    expect(destinations).toEqual(['B-01-02-1', 'B-01-02-2']);
  });

  test('keeps the top-first order and sequence numbers', () => {
    expect(plan().map(({ blocker }) => [blocker.tier, blocker.sequence])).toEqual([
      [4, 1],
      [3, 2],
      [2, 3],
    ]);
  });

  test('finds room while the yard has it and reports blockers without a destination otherwise', () => {
    const tinyYard = [{ ...blockB, bays: 2, maxTier: 5 }];
    const result = plan({ blocks: tinyYard, stackHeight: 5 });
    expect(result.filter(({ destination }) => destination === null)).toHaveLength(0);
    const fullYard = [{ ...blockB, bays: 1 }];
    const blocked = plan({ blocks: fullYard, stackHeight: 3 });
    expect(blocked.every(({ destination }) => destination === null)).toBe(true);
  });
});
