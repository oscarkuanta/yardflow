import { TERMINAL_TIME_ZONE } from '../../src/config/terminal.js';

const euroFormatter = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
const terminalTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TERMINAL_TIME_ZONE,
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatEuroCents(cents) {
  return euroFormatter.format(cents / 100);
}

export function formatTerminalTime(date) {
  return terminalTimeFormatter.format(date);
}

export function formatTable(headers, rows) {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => String(row[column]).length)),
  );
  const formatRow = (cells) =>
    cells.map((cell, column) => String(cell).padEnd(widths[column])).join('  ');
  const divider = widths.map((width) => '-'.repeat(width)).join('  ');
  return [formatRow(headers), divider, ...rows.map(formatRow)].join('\n');
}
