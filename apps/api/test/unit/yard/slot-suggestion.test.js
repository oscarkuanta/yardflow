import { describe, expect, test } from '@jest/globals';
import { suggestSlots } from '../../../src/modules/yard/slot-suggestion.js';
import { stackingProblems } from '../../../src/modules/yard/stacking-rules.js';
import { describeStack, stackAt, stackKey } from '../../../src/modules/yard/stacks.js';

const OWNER = 7;
const OTHER_OWNER = 8;

function block(overrides) {
  return {
    code: 'B',
    type: 'STANDARD',
    sizeClass: 'LARGE',
    rows: 1,
    bays: 2,
    maxTier: 5,
    gateDistanceM: 40,
    ...overrides,
  };
}

function stacksOf(...entries) {
  return new Map(
    entries.map(({ address, containers }) => [
      stackKey(address),
      describeStack(
        address,
        containers.map((container, index) => ({ ...container, tier: index + 1 })),
      ),
    ]),
  );
}

function containerOf(size, ownerCompanyId = OTHER_OWNER) {
  return { size, ownerCompanyId };
}

const full40 = { size: 'FT40', loadStatus: 'FULL', isDangerous: false, ownerCompanyId: OWNER };

describe('suggestSlots (spec 8.2)', () => {
  test('scores the spec example: same owner stack 123 at 40 m, empty stack 95 at 53 m', () => {
    const blockB = block({});
    const stacks = stacksOf({
      address: { blockCode: 'B', row: 1, bay: 1 },
      containers: [containerOf('FT40', OWNER)],
    });
    const suggestions = suggestSlots({ container: full40, blocks: [blockB], stacks });
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]).toEqual({
      blockCode: 'B',
      row: 1,
      bay: 1,
      tier: 2,
      positionCode: 'B-01-01-2',
      score: 123,
      distanceM: 40,
      reasons: ['Same owner below', 'Partly filled', 'Tier 2 of 5', '40 m to gate'],
    });
    expect(suggestions[1]).toMatchObject({
      positionCode: 'B-01-02-1',
      score: 95,
      distanceM: 53,
      reasons: ['Empty stack', 'Tier 1 of 5', '53 m to gate'],
    });
  });

  const mixedYard = [
    block({ code: 'A', sizeClass: 'SMALL' }),
    block({ code: 'B' }),
    block({ code: 'E', type: 'EMPTY' }),
    block({ code: 'X', type: 'DG', sizeClass: 'SMALL' }),
    block({ code: 'Y', type: 'DG', sizeClass: 'LARGE' }),
  ];

  test('never suggests a STANDARD or EMPTY block for a dangerous container', () => {
    for (const loadStatus of ['FULL', 'EMPTY']) {
      const suggestions = suggestSlots({
        container: { size: 'FT20', loadStatus, isDangerous: true },
        blocks: mixedYard,
        stacks: new Map(),
      });
      expect(suggestions.length).toBeGreaterThan(0);
      expect(new Set(suggestions.map((item) => item.blockCode))).toEqual(new Set(['X']));
    }
  });

  test('never suggests a STANDARD block for an empty container', () => {
    const suggestions = suggestSlots({
      container: { size: 'FT40', loadStatus: 'EMPTY', isDangerous: false },
      blocks: mixedYard,
      stacks: new Map(),
    });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((item) => item.blockCode === 'E')).toBe(true);
  });

  test('never suggests a LARGE block for a 20 ft container', () => {
    const suggestions = suggestSlots({
      container: { size: 'FT20', loadStatus: 'FULL', isDangerous: false },
      blocks: mixedYard,
      stacks: new Map(),
    });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((item) => item.blockCode === 'A')).toBe(true);
  });

  test.each([
    ['FT45', 'FT40'],
    ['FT40', 'FT45'],
  ])('never places a %s container on a %s container', (size, sizeBelow) => {
    const stacks = stacksOf(
      { address: { blockCode: 'B', row: 1, bay: 1 }, containers: [containerOf(sizeBelow)] },
      { address: { blockCode: 'B', row: 1, bay: 2 }, containers: [containerOf(sizeBelow)] },
    );
    const suggestions = suggestSlots({
      container: { size, loadStatus: 'FULL', isDangerous: false },
      blocks: [block({})],
      stacks,
    });
    expect(suggestions).toEqual([]);
  });

  test('never returns a full stack', () => {
    const fullStack = Array.from({ length: 5 }, () => containerOf('FT40', OWNER));
    const stacks = stacksOf({
      address: { blockCode: 'B', row: 1, bay: 1 },
      containers: fullStack,
    });
    const suggestions = suggestSlots({ container: full40, blocks: [block({})], stacks });
    expect(suggestions.map((item) => item.positionCode)).toEqual(['B-01-02-1']);
  });

  test('never returns an excluded stack', () => {
    const suggestions = suggestSlots({
      container: full40,
      blocks: [block({})],
      stacks: new Map(),
      excludedStacks: new Set(['B-1-1']),
    });
    expect(suggestions.map((item) => item.positionCode)).toEqual(['B-01-02-1']);
  });

  test('lets the closer stack win when scores are equal', () => {
    const near = block({ code: 'D', bays: 1, gateDistanceM: 30 });
    const far = block({ code: 'C', bays: 1, gateDistanceM: 39 });
    const suggestions = suggestSlots({ container: full40, blocks: [far, near], stacks: new Map() });
    expect(suggestions[0].score).toBe(suggestions[1].score);
    expect(suggestions.map((item) => item.blockCode)).toEqual(['D', 'C']);
  });

  test('breaks full ties by block code, then row, then bay', () => {
    const suggestions = suggestSlots({
      container: full40,
      blocks: [
        block({ code: 'Q', rows: 1, bays: 1, gateDistanceM: 0 }),
        block({ code: 'P', rows: 1, bays: 1, gateDistanceM: 0 }),
      ],
      stacks: new Map(),
    });
    expect(suggestions.map((item) => item.blockCode)).toEqual(['P', 'Q']);
  });

  test('returns an empty list when no stack fits', () => {
    const suggestions = suggestSlots({
      container: { size: 'FT20', loadStatus: 'EMPTY', isDangerous: false },
      blocks: mixedYard,
      stacks: new Map(),
    });
    expect(suggestions).toEqual([]);
  });

  test('returns at most 3 suggestions', () => {
    const suggestions = suggestSlots({
      container: full40,
      blocks: [block({ rows: 5, bays: 10 })],
      stacks: new Map(),
    });
    expect(suggestions).toHaveLength(3);
  });

  test('does not give the same owner bonus to a container without an owner', () => {
    const stacks = stacksOf({
      address: { blockCode: 'B', row: 1, bay: 1 },
      containers: [containerOf('FT40', null)],
    });
    const [best] = suggestSlots({
      container: { ...full40, ownerCompanyId: null },
      blocks: [block({})],
      stacks,
    });
    expect(best.reasons).not.toContain('Same owner below');
  });

  test('only suggests positions that pass every stacking rule', () => {
    const blocks = [block({ rows: 3, bays: 4, maxTier: 2 })];
    const stacks = stacksOf(
      { address: { blockCode: 'B', row: 1, bay: 1 }, containers: [containerOf('FT45')] },
      {
        address: { blockCode: 'B', row: 2, bay: 2 },
        containers: [containerOf('FT40'), containerOf('FT40')],
      },
    );
    const suggestions = suggestSlots({ container: full40, blocks, stacks, limit: 100 });
    expect(suggestions).toHaveLength(10);
    for (const suggestion of suggestions) {
      const stack = stackAt(stacks, suggestion);
      expect(
        stackingProblems({ container: full40, block: blocks[0], stack, tier: suggestion.tier }),
      ).toEqual([]);
    }
  });
});
