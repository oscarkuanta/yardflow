import { describe, expect, jest, test } from '@jest/globals';
import { clockFromStart, createShiftedClock, systemClock } from '../../src/lib/clock.js';
import { shouldSeed } from '../../prisma/seed/seed-on-start.js';

describe('clocks', () => {
  test('the system clock is the real time', () => {
    const before = Date.now();
    const now = systemClock().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(clockFromStart(null)).toBe(systemClock);
  });

  test('a shifted clock starts at the given time and keeps running', () => {
    jest.useFakeTimers({ now: new Date('2030-01-01T00:00:00Z') });
    try {
      const clock = createShiftedClock(new Date('2026-10-07T08:10:00Z'));
      expect(clock().toISOString()).toBe('2026-10-07T08:10:00.000Z');
      jest.advanceTimersByTime(90_000);
      expect(clock().toISOString()).toBe('2026-10-07T08:11:30.000Z');
      expect(clockFromStart('2026-10-07T08:10:00Z')().toISOString()).toBe(
        '2026-10-07T08:10:00.000Z',
      );
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('seed on start', () => {
  test('seeds always, only into an empty database, or never', () => {
    expect(shouldSeed('always', 5)).toBe(true);
    expect(shouldSeed('if-empty', 0)).toBe(true);
    expect(shouldSeed('if-empty', 5)).toBe(false);
    expect(shouldSeed('never', 0)).toBe(false);
    expect(() => shouldSeed('sometimes', 0)).toThrow('SEED_ON_START must be one of');
  });
});
