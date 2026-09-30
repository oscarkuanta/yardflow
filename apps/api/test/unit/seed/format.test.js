import { describe, expect, test } from '@jest/globals';
import { formatEuroCents, formatTable, formatTerminalTime } from '../../../prisma/seed/format.js';

describe('seed formatting helpers', () => {
  test('formats cents as euros', () => {
    expect(formatEuroCents(1800)).toBe('€18.00');
  });

  test('formats an instant in Berlin time', () => {
    expect(formatTerminalTime(new Date('2026-09-30T06:00:00Z'))).toContain('08:00');
  });

  test('pads table columns to the widest cell', () => {
    expect(formatTable(['A', 'Long'], [['xyz', 1]])).toBe('A    Long\n---  ----\nxyz  1   ');
  });
});
