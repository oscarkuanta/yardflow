import { describe, expect, test } from '@jest/globals';
import { bookingProblem, countBookings } from '../../src/modules/timeslots/availability.js';

const NOW = new Date('2026-09-30T08:00:00Z');

function slotOn(date, startHour, capacity = 10) {
  return { date: new Date(`${date}T00:00:00Z`), startHour, capacity };
}

function startOf(date, startHour) {
  const hourUtc = String(startHour - 2).padStart(2, '0');
  return new Date(`${date}T${hourUtc}:00:00Z`);
}

function problemFor(date, startHour, { bookedCount = 0, capacity } = {}) {
  const slot = slotOn(date, startHour, capacity);
  return bookingProblem({ slot, slotStart: startOf(date, startHour), bookedCount, now: NOW });
}

describe('time slot availability (spec 8.6)', () => {
  test('accepts a free slot tomorrow', () => {
    expect(problemFor('2026-10-01', 8)).toBeNull();
  });

  test('rejects a full slot', () => {
    expect(problemFor('2026-10-01', 9, { bookedCount: 10 })).toEqual({
      code: 'SLOT_FULL',
      message: 'This time slot is full, please choose another',
    });
    expect(problemFor('2026-10-01', 9, { bookedCount: 3, capacity: 3 }).code).toBe('SLOT_FULL');
  });

  test('does not count cancelled or expired bookings', () => {
    const bookings = ['ACTIVE', 'USED', 'CANCELLED', 'EXPIRED', 'CANCELLED'].map((status) => ({
      status,
    }));
    expect(countBookings(bookings)).toBe(2);
    expect(
      problemFor('2026-10-01', 9, { bookedCount: countBookings(bookings), capacity: 3 }),
    ).toBeNull();
  });

  test('rejects a booking less than 60 minutes before the slot starts', () => {
    expect(problemFor('2026-09-30', 10)).toEqual({
      code: 'SLOT_TOO_SOON',
      message: 'Book at least 60 minutes before the slot starts',
    });
    expect(problemFor('2026-09-30', 8).code).toBe('SLOT_TOO_SOON');
  });

  test('accepts a booking today exactly 60 minutes before the slot starts', () => {
    expect(problemFor('2026-09-30', 11)).toBeNull();
  });

  test('rejects a booking more than 14 days ahead', () => {
    expect(problemFor('2026-10-14', 16)).toBeNull();
    expect(problemFor('2026-10-15', 8)).toEqual({
      code: 'SLOT_TOO_FAR_AHEAD',
      message: 'Slots can be booked up to 14 days ahead',
    });
  });

  test('has no slots on Sunday', () => {
    expect(problemFor('2026-10-04', 10).code).toBe('SLOT_CLOSED');
  });

  test('has no slots outside 08:00 to 17:00', () => {
    expect(problemFor('2026-10-01', 17).code).toBe('SLOT_CLOSED');
    expect(problemFor('2026-10-01', 7).code).toBe('SLOT_CLOSED');
  });
});
