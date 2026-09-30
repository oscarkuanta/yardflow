import { TERMINAL_TIME_ZONE } from '../config/terminal.js';

const euroFormatter = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
const weightFormatter = new Intl.NumberFormat('en-GB');
const terminalDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TERMINAL_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const terminalClockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TERMINAL_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatEuroCents(cents) {
  return euroFormatter.format(cents / 100);
}

export function formatKilograms(kilograms) {
  return `${weightFormatter.format(kilograms)} kg`;
}

export function formatTerminalDateTime(date) {
  return terminalDateTimeFormatter.format(date);
}

export function formatTerminalClock(date) {
  return terminalClockFormatter.format(date);
}
