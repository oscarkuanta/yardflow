import { describe, expect, test } from '@jest/globals';
import { createRandom } from '../../../prisma/seed/random.js';

function sample(seed, count) {
  const random = createRandom(seed);
  return Array.from({ length: count }, () => random.next());
}

describe('createRandom', () => {
  test('returns the same sequence for the same seed', () => {
    expect(sample(42, 20)).toEqual(sample(42, 20));
  });

  test('returns a different sequence for a different seed', () => {
    expect(sample(42, 20)).not.toEqual(sample(43, 20));
  });

  test('returns numbers from 0 up to but not including 1', () => {
    for (const value of sample(7, 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  test('integer stays inside the inclusive range and reaches both ends', () => {
    const random = createRandom(1);
    const values = new Set(Array.from({ length: 500 }, () => random.integer(3, 6)));
    expect([...values].sort()).toEqual([3, 4, 5, 6]);
  });

  test('pick throws on an empty list', () => {
    expect(() => createRandom(1).pick([])).toThrow('Cannot pick from an empty list');
  });

  test('pickWeighted never returns a value with weight 0', () => {
    const random = createRandom(5);
    for (let index = 0; index < 200; index += 1) {
      expect(random.pickWeighted({ never: 0, always: 1 })).toBe('always');
    }
  });

  test('shuffle keeps every item and leaves the input untouched', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = createRandom(9).shuffle(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...shuffled].sort()).toEqual(items);
  });

  test('chance(0) is always false and chance(1) is always true', () => {
    const random = createRandom(3);
    for (let index = 0; index < 100; index += 1) {
      expect(random.chance(0)).toBe(false);
      expect(random.chance(1)).toBe(true);
    }
  });
});
