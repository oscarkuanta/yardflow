import { TERMINAL_TIME_ZONE } from '../config/terminal.js';

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

const terminalFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TERMINAL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function getTerminalParts(date) {
  const parts = Object.fromEntries(
    terminalFormatter.formatToParts(date).map(({ type, value }) => [type, Number(value)]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function offsetMsAt(date) {
  const parts = getTerminalParts(date);
  const wallClockAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return wallClockAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function terminalDateTime({ year, month, day }, hour = 0, minute = 0) {
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = wallClockAsUtc - offsetMsAt(new Date(wallClockAsUtc));
  return new Date(wallClockAsUtc - offsetMsAt(new Date(firstGuess)));
}

export function terminalDateOf(date) {
  const { year, month, day } = getTerminalParts(date);
  return { year, month, day };
}

export function addCalendarDays({ year, month, day }, days) {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function weekdayOf({ year, month, day }) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function calendarDateToDbDate({ year, month, day }) {
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatCalendarDate({ year, month, day }, separator = '-') {
  return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join(separator);
}

export function dbDateToCalendarDate(date) {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function parseCalendarDate(text) {
  const [year, month, day] = text.split('-').map(Number);
  return { year, month, day };
}

export function compareCalendarDates(first, second) {
  return calendarDateToDbDate(first).getTime() - calendarDateToDbDate(second).getTime();
}
