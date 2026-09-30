import { describe, expect, test } from '@jest/globals';
import { formatPositionCode } from '../src/index.js';

describe('formatPositionCode', () => {
  test('pads row and bay to two digits', () => {
    expect(formatPositionCode({ blockCode: 'A', row: 3, bay: 7, tier: 2 })).toBe('A-03-07-2');
  });

  test('keeps two-digit rows and bays unchanged', () => {
    expect(formatPositionCode({ blockCode: 'B', row: 10, bay: 12, tier: 5 })).toBe('B-10-12-5');
  });
});
