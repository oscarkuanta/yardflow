export const TERMINAL_TIME_ZONE = 'Europe/Berlin';

const numberFormatter = new Intl.NumberFormat('en-GB');
const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TERMINAL_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatNumber(value) {
  return value === null || value === undefined ? '—' : numberFormatter.format(value);
}

export function formatDecimal(value, digits = 1) {
  return value === null || value === undefined ? '—' : value.toFixed(digits);
}

export function formatClock(isoDate) {
  return clockFormatter.format(new Date(isoDate));
}

export function initialsOf(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export const ROLE_LABELS = {
  ADMIN: 'Admin',
  PLANNER: 'Planner',
  GATE_OPERATOR: 'Gate operator',
  CUSTOMER: 'Customer',
};
