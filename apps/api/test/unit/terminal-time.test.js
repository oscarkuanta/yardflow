import { describe, expect, test } from '@jest/globals';
import {
  addCalendarDays,
  calendarDateToDbDate,
  formatCalendarDate,
  getTerminalParts,
  terminalDateOf,
  terminalDateTime,
  weekdayOf,
} from '../../src/lib/terminal-time.js';

describe('terminalDateTime', () => {
  test('uses UTC+2 in summer time', () => {
    expect(terminalDateTime({ year: 2026, month: 9, day: 30 }, 8).toISOString()).toBe(
      '2026-09-30T06:00:00.000Z',
    );
  });

  test('uses UTC+1 in winter time', () => {
    expect(terminalDateTime({ year: 2026, month: 12, day: 1 }, 8, 30).toISOString()).toBe(
      '2026-12-01T07:30:00.000Z',
    );
  });

  test('handles the day the clocks go back', () => {
    const day = { year: 2026, month: 10, day: 25 };
    expect(terminalDateTime(day, 0).toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(terminalDateTime(day, 8).toISOString()).toBe('2026-10-25T07:00:00.000Z');
  });

  test('handles the day the clocks go forward', () => {
    expect(terminalDateTime({ year: 2026, month: 3, day: 29 }, 8).toISOString()).toBe(
      '2026-03-29T06:00:00.000Z',
    );
  });

  test('rolls hour 24 over to the next day', () => {
    expect(terminalDateTime({ year: 2026, month: 9, day: 30 }, 24).toISOString()).toBe(
      '2026-09-30T22:00:00.000Z',
    );
  });
});

describe('terminal calendar helpers', () => {
  test('reads the Berlin wall clock of an instant', () => {
    expect(getTerminalParts(new Date('2026-09-30T22:30:00Z'))).toEqual({
      year: 2026,
      month: 10,
      day: 1,
      hour: 0,
      minute: 30,
      second: 0,
    });
  });

  test('returns the Berlin calendar date, not the UTC date', () => {
    expect(terminalDateOf(new Date('2026-12-31T23:30:00Z'))).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
  });

  test('adds days across month and year ends', () => {
    expect(addCalendarDays({ year: 2026, month: 12, day: 30 }, 3)).toEqual({
      year: 2027,
      month: 1,
      day: 2,
    });
    expect(addCalendarDays({ year: 2026, month: 3, day: 1 }, -1)).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    });
  });

  test('returns 0 for Sunday and 3 for Wednesday', () => {
    expect(weekdayOf({ year: 2026, month: 10, day: 4 })).toBe(0);
    expect(weekdayOf({ year: 2026, month: 9, day: 30 })).toBe(3);
  });

  test('stores a calendar date as UTC midnight for DATE columns', () => {
    expect(calendarDateToDbDate({ year: 2026, month: 9, day: 5 }).toISOString()).toBe(
      '2026-09-05T00:00:00.000Z',
    );
  });

  test('formats a calendar date with a separator', () => {
    expect(formatCalendarDate({ year: 2026, month: 9, day: 5 })).toBe('2026-09-05');
    expect(formatCalendarDate({ year: 2026, month: 9, day: 5 }, '')).toBe('20260905');
  });
});
