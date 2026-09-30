import { describe, expect, test } from '@jest/globals';
import { normalizeDriverName, normalizeTruckPlate } from '../src/index.js';

describe('normalizeTruckPlate', () => {
  test('uppercases, trims and collapses spaces', () => {
    expect(normalizeTruckPlate('  hh-yf   482 ')).toBe('HH-YF 482');
  });

  test('returns an empty string for non-string input', () => {
    expect(normalizeTruckPlate(null)).toBe('');
  });
});

describe('normalizeDriverName', () => {
  test('ignores case and surrounding or repeated spaces', () => {
    expect(normalizeDriverName('  Jan   BECKER ')).toBe(normalizeDriverName('jan becker'));
  });

  test('returns an empty string for non-string input', () => {
    expect(normalizeDriverName(undefined)).toBe('');
  });
});
