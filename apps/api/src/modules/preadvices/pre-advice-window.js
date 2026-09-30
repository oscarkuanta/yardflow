import { MINUTE_MS, dbDateToCalendarDate, terminalDateTime } from '../../lib/terminal-time.js';

export function slotWindow(slot, toleranceMin) {
  const calendarDate = dbDateToCalendarDate(slot.date);
  const startsAt = terminalDateTime(calendarDate, slot.startHour);
  const endsAt = terminalDateTime(calendarDate, slot.startHour + 1);
  return {
    startsAt,
    endsAt,
    opensAt: new Date(startsAt.getTime() - toleranceMin * MINUTE_MS),
    closesAt: new Date(endsAt.getTime() + toleranceMin * MINUTE_MS),
  };
}

export function isInsideWindow(window, now) {
  return now >= window.opensAt && now <= window.closesAt;
}

export function isOverdue(window, now) {
  return now > window.closesAt;
}
