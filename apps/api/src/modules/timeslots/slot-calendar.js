import {
  BOOKING_HORIZON_DAYS,
  FIRST_SLOT_HOUR,
  LAST_SLOT_HOUR,
  SUNDAY,
} from '../../config/terminal.js';
import {
  addCalendarDays,
  compareCalendarDates,
  dbDateToCalendarDate,
  formatCalendarDate,
  terminalDateTime,
  weekdayOf,
} from '../../lib/terminal-time.js';

export const SLOT_START_HOURS = Array.from(
  { length: LAST_SLOT_HOUR - FIRST_SLOT_HOUR + 1 },
  (_, index) => FIRST_SLOT_HOUR + index,
);

export function isOperatingDay(calendarDate) {
  return weekdayOf(calendarDate) !== SUNDAY;
}

export function isBeyondHorizon(calendarDate, today) {
  return compareCalendarDates(calendarDate, addCalendarDays(today, BOOKING_HORIZON_DAYS)) > 0;
}

export function isInCreationWindow(calendarDate, today) {
  return compareCalendarDates(calendarDate, today) >= 0 && !isBeyondHorizon(calendarDate, today);
}

export function presentSlot(slot, bookedCount) {
  const calendarDate = dbDateToCalendarDate(slot.date);
  return {
    id: slot.id,
    date: formatCalendarDate(calendarDate),
    startHour: slot.startHour,
    startsAt: terminalDateTime(calendarDate, slot.startHour),
    endsAt: terminalDateTime(calendarDate, slot.startHour + 1),
    capacity: slot.capacity,
    booked: bookedCount,
    remaining: Math.max(0, slot.capacity - bookedCount),
    isFull: bookedCount >= slot.capacity,
  };
}

export function slotsBookedBeyond(slots, bookedCounts, capacity) {
  return slots
    .map((slot) => ({ slot, booked: bookedCounts.get(slot.id) ?? 0 }))
    .filter(({ booked }) => booked > capacity);
}
