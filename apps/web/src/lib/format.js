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

const euroFormatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TERMINAL_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TERMINAL_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const calendarDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TERMINAL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;

export function formatEuro(cents) {
  return cents === null || cents === undefined ? '—' : euroFormatter.format(cents / 100);
}

export function formatDateTime(isoDate) {
  return isoDate ? dateTimeFormatter.format(new Date(isoDate)) : '—';
}

export function formatDate(isoDate) {
  return isoDate ? dateFormatter.format(new Date(isoDate)) : '—';
}

export function terminalCalendarDate(date) {
  return calendarDateFormatter.format(date);
}

export function addDaysToCalendarDate(calendarDate, days) {
  const date = new Date(`${calendarDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatAge(minutes) {
  if (minutes === null || minutes === undefined) {
    return '—';
  }
  if (minutes < MINUTES_PER_HOUR) {
    return `${minutes} min`;
  }
  if (minutes < MINUTES_PER_DAY) {
    return `${Math.floor(minutes / MINUTES_PER_HOUR)} h`;
  }
  return `${Math.floor(minutes / MINUTES_PER_DAY)} d`;
}

export const SIZE_LABELS = { FT20: "20'", FT40: "40'", FT45: "45'" };

export function describeCargo({ size, isHighCube, loadStatus }) {
  const parts = [SIZE_LABELS[size] ?? size];
  if (isHighCube) {
    parts.push('HC');
  }
  parts.push(loadStatus === 'EMPTY' ? 'Empty' : 'Full');
  return parts.join(' · ');
}

export function titleCase(value) {
  return value
    .toLowerCase()
    .split('_')
    .map((word, index) => (index === 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}
