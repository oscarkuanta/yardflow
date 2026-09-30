import {
  BOOKING_HORIZON_DAYS,
  DEFAULT_SLOT_CAPACITY,
  FIRST_SLOT_HOUR,
  LAST_SLOT_HOUR,
  SUNDAY,
} from '../../src/config/terminal.js';
import {
  DAY_MS,
  addCalendarDays,
  calendarDateToDbDate,
  terminalDateTime,
  weekdayOf,
} from '../../src/lib/terminal-time.js';
import {
  BASE_DAILY_RATE_CENTS,
  BLOCKS,
  COMPANIES,
  DANGEROUS_FREE_DAYS,
  DANGEROUS_RATE_FACTOR,
  DEMO_PASSWORD,
  GATE_HISTORY_DAYS,
  STANDARD_FREE_DAYS,
  USERS,
} from './reference-data.js';
import { companyByCode } from './seed-context.js';

const ACCOUNT_AGE_DAYS = 90;

function addCompaniesAndUsers(context) {
  const createdAt = new Date(context.now.getTime() - ACCOUNT_AGE_DAYS * DAY_MS);
  for (const { code, name, contactEmail } of COMPANIES) {
    context.insert('companies', { code, name, contactEmail, isActive: true, createdAt });
  }
  for (const { email, name, role, companyCode } of USERS) {
    context.insert('users', {
      email,
      name,
      password: DEMO_PASSWORD,
      role,
      companyId: companyCode ? companyByCode(context, companyCode).id : null,
      isActive: true,
      lastLoginAt: null,
      createdAt,
    });
  }
}

function addBlocksAndTariffs(context) {
  for (const block of BLOCKS) {
    context.insert('blocks', { ...block });
  }
  for (const [size, baseRate] of Object.entries(BASE_DAILY_RATE_CENTS)) {
    context.insert('tariffs', {
      size,
      isDangerous: false,
      freeDays: STANDARD_FREE_DAYS,
      dailyRateCents: baseRate,
    });
    context.insert('tariffs', {
      size,
      isDangerous: true,
      freeDays: DANGEROUS_FREE_DAYS,
      dailyRateCents: baseRate * DANGEROUS_RATE_FACTOR,
    });
  }
}

function addTimeSlotsForDay(context, dayOffset) {
  const calendarDate = addCalendarDays(context.today, dayOffset);
  const weekday = weekdayOf(calendarDate);
  if (weekday === SUNDAY) {
    return;
  }
  for (let hour = FIRST_SLOT_HOUR; hour <= LAST_SLOT_HOUR; hour += 1) {
    const row = context.insert('timeSlots', {
      date: calendarDateToDbDate(calendarDate),
      startHour: hour,
      capacity: DEFAULT_SLOT_CAPACITY,
    });
    context.slots.push({
      row,
      dayOffset,
      weekday,
      start: terminalDateTime(calendarDate, hour),
      end: terminalDateTime(calendarDate, hour + 1),
      bookedCount: 0,
    });
  }
}

export function addReferenceData(context) {
  addCompaniesAndUsers(context);
  addBlocksAndTariffs(context);
  for (let dayOffset = -GATE_HISTORY_DAYS; dayOffset <= BOOKING_HORIZON_DAYS; dayOffset += 1) {
    addTimeSlotsForDay(context, dayOffset);
  }
}
