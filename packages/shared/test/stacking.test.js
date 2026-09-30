import { describe, expect, test } from '@jest/globals';
import { requiredBlockType, requiredSizeClass } from '../src/index.js';

describe('requiredBlockType', () => {
  test('sends dangerous goods to DG blocks, full or empty', () => {
    expect(requiredBlockType({ loadStatus: 'FULL', isDangerous: true })).toBe('DG');
    expect(requiredBlockType({ loadStatus: 'EMPTY', isDangerous: true })).toBe('DG');
  });

  test('sends empty non-DG containers to EMPTY blocks', () => {
    expect(requiredBlockType({ loadStatus: 'EMPTY', isDangerous: false })).toBe('EMPTY');
  });

  test('sends full non-DG containers to STANDARD blocks', () => {
    expect(requiredBlockType({ loadStatus: 'FULL', isDangerous: false })).toBe('STANDARD');
  });
});

describe('requiredSizeClass', () => {
  test.each([
    ['FT20', 'SMALL'],
    ['FT40', 'LARGE'],
    ['FT45', 'LARGE'],
  ])('%s needs a %s block', (size, expected) => {
    expect(requiredSizeClass({ size })).toBe(expected);
  });
});
