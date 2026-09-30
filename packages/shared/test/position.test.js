import { describe, expect, test } from '@jest/globals';
import { formatPositionCode, formatStackCode, parsePositionCode } from '../src/index.js';

describe('formatPositionCode', () => {
  test('pads row and bay to two digits', () => {
    expect(formatPositionCode({ blockCode: 'A', row: 3, bay: 7, tier: 2 })).toBe('A-03-07-2');
  });

  test('keeps two-digit rows and bays unchanged', () => {
    expect(formatPositionCode({ blockCode: 'B', row: 10, bay: 12, tier: 5 })).toBe('B-10-12-5');
  });
});

describe('formatStackCode', () => {
  test('leaves out the tier', () => {
    expect(formatStackCode({ blockCode: 'X', row: 1, bay: 6 })).toBe('X-01-06');
  });
});

describe('parsePositionCode', () => {
  test('reads a full position code', () => {
    expect(parsePositionCode('A-03-07-2')).toEqual({ blockCode: 'A', row: 3, bay: 7, tier: 2 });
  });

  test('reads a stack code without tier, ignoring case and spaces', () => {
    expect(parsePositionCode(' b-02-05 ')).toEqual({ blockCode: 'B', row: 2, bay: 5, tier: null });
  });

  test('reads two-character block codes', () => {
    expect(parsePositionCode('B2-01-01-1')?.blockCode).toBe('B2');
  });

  test.each(['A-3-7-2', 'A-03-07-12', 'A03072', '1A-01-01-1', '', null, 42])(
    'returns null for %p',
    (input) => {
      expect(parsePositionCode(input)).toBeNull();
    },
  );
});
