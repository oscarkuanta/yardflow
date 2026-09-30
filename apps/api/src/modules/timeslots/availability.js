import { BOOKING_HORIZON_DAYS } from '../../config/terminal.js';
import { MINUTE_MS, dbDateToCalendarDate, terminalDateOf } from '../../lib/terminal-time.js';
import { SLOT_START_HOURS, isBeyondHorizon, isOperatingDay } from './slot-calendar.js';

export const MIN_BOOKING_LEAD_MINUTES = 60;
export const COUNTED_BOOKING_STATUSES = ['ACTIVE', 'USED'];

export function countBookings(preAdvices) {
  return preAdvices.filter((preAdvice) => COUNTED_BOOKING_STATUSES.includes(preAdvice.status))
    .length;
}

export function bookingProblem({ slot, slotStart, bookedCount, now }) {
  const slotDate = dbDateToCalendarDate(slot.date);
  if (!isOperatingDay(slotDate) || !SLOT_START_HOURS.includes(slot.startHour)) {
    return { code: 'SLOT_CLOSED', message: 'The gate has no slots at this time' };
  }
  if (slotStart.getTime() - now.getTime() < MIN_BOOKING_LEAD_MINUTES * MINUTE_MS) {
    return {
      code: 'SLOT_TOO_SOON',
      message: `Book at least ${MIN_BOOKING_LEAD_MINUTES} minutes before the slot starts`,
    };
  }
  if (isBeyondHorizon(slotDate, terminalDateOf(now))) {
    return {
      code: 'SLOT_TOO_FAR_AHEAD',
      message: `Slots can be booked up to ${BOOKING_HORIZON_DAYS} days ahead`,
    };
  }
  if (bookedCount >= slot.capacity) {
    return { code: 'SLOT_FULL', message: 'This time slot is full, please choose another' };
  }
  return null;
}
