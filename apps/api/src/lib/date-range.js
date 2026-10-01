import { z } from 'zod';
import { addCalendarDays, parseCalendarDate, terminalDateTime } from './terminal-time.js';

export const dateQuery = z.iso.date('Use a real date in the format YYYY-MM-DD');

export const dateRangeFilters = {
  from: dateQuery.optional(),
  to: dateQuery.optional(),
};

export function terminalDayRange({ from, to }) {
  if (!from && !to) {
    return undefined;
  }
  return {
    ...(from && { gte: terminalDateTime(parseCalendarDate(from), 0) }),
    ...(to && { lt: terminalDateTime(addCalendarDays(parseCalendarDate(to), 1), 0) }),
  };
}

export function fromNotAfterTo({ from, to }) {
  return !from || !to || from <= to;
}

export const FROM_NOT_AFTER_TO = { message: 'from must not be after to', path: ['from'] };
