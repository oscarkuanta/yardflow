import { describe, expect, test } from '@jest/globals';
import {
  INVALID_CHECK_DIGIT_MESSAGE,
  INVALID_FORMAT_MESSAGE,
  computeCheckDigit,
  computeWeightedSum,
  formatContainerNumber,
  generateContainerNumber,
  getContainerNumberError,
  isValidContainerNumber,
  letterValue,
  normalizeContainerNumber,
} from '../src/index.js';

describe('letterValue', () => {
  test.each([
    ['A', 10],
    ['B', 12],
    ['K', 21],
    ['L', 23],
    ['U', 32],
    ['V', 34],
    ['Z', 38],
  ])('%s has value %i', (letter, expected) => {
    expect(letterValue(letter)).toBe(expected);
  });

  test('skips every multiple of 11', () => {
    const values = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letterValue);
    expect(values).not.toContain(11);
    expect(values).not.toContain(22);
    expect(values).not.toContain(33);
  });

  test('throws for a character that is not an uppercase letter', () => {
    expect(() => letterValue('a')).toThrow('Not an uppercase letter');
    expect(() => letterValue('1')).toThrow('Not an uppercase letter');
  });
});

describe('computeWeightedSum and computeCheckDigit', () => {
  test.each([
    ['CSQU305438', 6185, 3],
    ['HNFU204571', 3620, 1],
    ['NRTU553018', 5247, 0],
    ['HNFU000003', 1924, 0],
  ])('%s has sum %i and check digit %i', (firstTen, expectedSum, expectedDigit) => {
    expect(computeWeightedSum(firstTen)).toBe(expectedSum);
    expect(computeCheckDigit(firstTen)).toBe(expectedDigit);
  });

  test('remainder 10 gives check digit 0', () => {
    expect(computeWeightedSum('HNFU000003') % 11).toBe(10);
    expect(computeCheckDigit('HNFU000003')).toBe(0);
  });

  test('throws when the input is not 4 letters and 6 digits', () => {
    expect(() => computeWeightedSum('CSQU30543')).toThrow('Expected 4 letters and 6 digits');
    expect(() => computeCheckDigit('csqu305438')).toThrow('Expected 4 letters and 6 digits');
  });
});

describe('normalizeContainerNumber', () => {
  test('uppercases and removes spaces', () => {
    expect(normalizeContainerNumber(' csqu 305438 3 ')).toBe('CSQU3054383');
  });

  test('returns an empty string for non-string input', () => {
    expect(normalizeContainerNumber(null)).toBe('');
    expect(normalizeContainerNumber(undefined)).toBe('');
    expect(normalizeContainerNumber(12345)).toBe('');
  });
});

describe('isValidContainerNumber', () => {
  test.each(['CSQU3054383', 'csqu 305438 3', 'HNFU2045711', 'NRTU5530180', 'HNFU0000030'])(
    '%s is valid',
    (input) => {
      expect(isValidContainerNumber(input)).toBe(true);
    },
  );

  test.each([
    ['CSQU3054384', 'wrong check digit'],
    ['CSQ3054383', 'owner code too short'],
    ['CSQX3054383', 'category is not U, J or Z'],
    ['', 'empty string'],
    [null, 'null'],
    [undefined, 'undefined'],
  ])('%s is invalid (%s)', (input) => {
    expect(isValidContainerNumber(input)).toBe(false);
  });

  test('accepts categories J and Z', () => {
    expect(isValidContainerNumber(generateContainerNumber('ABCJ', 1))).toBe(true);
    expect(isValidContainerNumber(generateContainerNumber('ABCZ', 1))).toBe(true);
  });
});

describe('getContainerNumberError', () => {
  test('returns null for a valid number', () => {
    expect(getContainerNumberError('HNFU2045711')).toBeNull();
  });

  test('reports a wrong check digit', () => {
    expect(getContainerNumberError('CSQU3054384')).toBe(INVALID_CHECK_DIGIT_MESSAGE);
    expect(INVALID_CHECK_DIGIT_MESSAGE).toBe(
      'Invalid container number: check digit does not match',
    );
  });

  test.each(['CSQ3054383', 'CSQX3054383', '', null, 'CSQU30543831'])(
    'reports a bad format for %s',
    (input) => {
      expect(getContainerNumberError(input)).toBe(INVALID_FORMAT_MESSAGE);
    },
  );

  test('uses the exact format message from the spec', () => {
    expect(INVALID_FORMAT_MESSAGE).toBe('Invalid container number format');
  });
});

describe('formatContainerNumber', () => {
  test('splits into owner code, serial and check digit', () => {
    expect(formatContainerNumber('HNFU2045711')).toBe('HNFU 204571 1');
  });

  test('normalizes before formatting', () => {
    expect(formatContainerNumber('hnfu 2045711')).toBe('HNFU 204571 1');
  });

  test('returns the normalized input when the length is not 11', () => {
    expect(formatContainerNumber('hnfu 20')).toBe('HNFU20');
    expect(formatContainerNumber(null)).toBe('');
  });
});

describe('generateContainerNumber', () => {
  test('appends the correct check digit', () => {
    expect(generateContainerNumber('HNFU', 204571)).toBe('HNFU2045711');
    expect(generateContainerNumber('CSQU', 305438)).toBe('CSQU3054383');
  });

  test('pads the serial to 6 digits', () => {
    expect(generateContainerNumber('HNFU', 3)).toBe('HNFU0000030');
  });

  test('always produces valid numbers', () => {
    for (let serial = 0; serial < 2000; serial += 1) {
      expect(isValidContainerNumber(generateContainerNumber('NRTU', serial))).toBe(true);
    }
  });

  test.each(['HNF', 'HNFX', 'hnfu', 'HNFUU', ''])('rejects the owner prefix %s', (prefix) => {
    expect(() => generateContainerNumber(prefix, 1)).toThrow('Invalid owner prefix');
  });

  test.each([-1, 1000000, 1.5, '12'])('rejects the serial %s', (serial) => {
    expect(() => generateContainerNumber('HNFU', serial)).toThrow('Serial must be an integer');
  });
});
