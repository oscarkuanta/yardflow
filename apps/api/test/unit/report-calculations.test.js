import { describe, expect, test } from '@jest/globals';
import {
  averageDwellDays,
  blockOccupancy,
  dailyGateMoves,
  oldestAgeMinutes,
  weekStartOf,
  weeklyDwell,
  yardOccupancy,
} from '../../src/modules/reports/report-calculations.js';

const NOW = new Date('2026-09-30T08:00:00Z');
const TODAY = { year: 2026, month: 9, day: 30 };

describe('occupancy', () => {
  const blockB = { code: 'B', type: 'STANDARD', sizeClass: 'LARGE', rows: 5, bays: 10, maxTier: 5 };
  const blockA = { code: 'A', type: 'STANDARD', sizeClass: 'SMALL', rows: 2, bays: 5, maxTier: 5 };

  test('counts TEU by container size against the block capacity', () => {
    expect(blockOccupancy(blockB, ['FT40', 'FT45', 'FT40'])).toEqual({
      code: 'B',
      type: 'STANDARD',
      sizeClass: 'LARGE',
      capacitySlots: 250,
      usedSlots: 3,
      teuCapacity: 500,
      teuUsed: 6,
      occupancyPercent: 1.2,
    });
  });

  test('adds up the whole yard', () => {
    const blocks = [blockOccupancy(blockB, ['FT40']), blockOccupancy(blockA, ['FT20', 'FT20'])];
    expect(yardOccupancy(blocks)).toEqual({
      containersInYard: 3,
      teuUsed: 4,
      teuCapacity: 550,
      percent: 0.7,
    });
    expect(yardOccupancy([]).percent).toBe(0);
  });
});

describe('dwell', () => {
  test('averages the days containers have spent in the yard', () => {
    const gateIns = [new Date('2026-09-28T08:00:00Z'), new Date('2026-09-25T20:00:00Z')];
    expect(averageDwellDays(gateIns, NOW)).toBe(3.3);
    expect(averageDwellDays([], NOW)).toBeNull();
  });

  test('starts weeks on Monday in Berlin', () => {
    expect(weekStartOf(TODAY)).toEqual({ year: 2026, month: 9, day: 28 });
    expect(weekStartOf({ year: 2026, month: 10, day: 4 })).toEqual({
      year: 2026,
      month: 9,
      day: 28,
    });
    expect(weekStartOf({ year: 2026, month: 9, day: 28 })).toEqual({
      year: 2026,
      month: 9,
      day: 28,
    });
  });

  test('averages completed stays per week of departure, oldest week first', () => {
    const weeks = weeklyDwell(
      [
        {
          gateInAt: new Date('2026-09-20T08:00:00Z'),
          departedAt: new Date('2026-09-29T08:00:00Z'),
        },
        {
          gateInAt: new Date('2026-09-26T08:00:00Z'),
          departedAt: new Date('2026-09-30T08:00:00Z'),
        },
        {
          gateInAt: new Date('2026-09-10T08:00:00Z'),
          departedAt: new Date('2026-09-22T08:00:00Z'),
        },
        {
          gateInAt: new Date('2026-01-10T08:00:00Z'),
          departedAt: new Date('2026-01-12T08:00:00Z'),
        },
      ],
      { today: TODAY, weeks: 3 },
    );
    expect(weeks).toEqual([
      { weekStart: '2026-09-14', departures: 0, averageDwellDays: null },
      { weekStart: '2026-09-21', departures: 1, averageDwellDays: 12 },
      { weekStart: '2026-09-28', departures: 2, averageDwellDays: 6.5 },
    ]);
  });
});

describe('dailyGateMoves', () => {
  test('counts in and out per Berlin day and keeps days without moves', () => {
    const days = dailyGateMoves(
      [
        { direction: 'IN', createdAt: new Date('2026-09-30T06:00:00Z') },
        { direction: 'OUT', createdAt: new Date('2026-09-30T07:00:00Z') },
        { direction: 'IN', createdAt: new Date('2026-09-28T22:30:00Z') },
        { direction: 'IN', createdAt: new Date('2026-09-01T07:00:00Z') },
      ],
      { today: TODAY, days: 3 },
    );
    expect(days).toEqual([
      { date: '2026-09-28', in: 0, out: 0 },
      { date: '2026-09-29', in: 1, out: 0 },
      { date: '2026-09-30', in: 1, out: 1 },
    ]);
  });
});

describe('oldestAgeMinutes', () => {
  test('returns the age of the oldest time in minutes, or null', () => {
    expect(
      oldestAgeMinutes([new Date('2026-09-30T07:30:00Z'), new Date('2026-09-30T06:00:00Z')], NOW),
    ).toBe(120);
    expect(oldestAgeMinutes([], NOW)).toBeNull();
  });
});
