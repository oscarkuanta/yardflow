import { TEU_BY_SIZE } from '@yardflow/shared';
import {
  DAY_MS,
  addCalendarDays,
  formatCalendarDate,
  terminalDateOf,
  weekdayOf,
} from '../../lib/terminal-time.js';
import { TEU_PER_SLOT, slotCount } from '../blocks/block-geometry.js';

const DAYS_FROM_MONDAY = [6, 0, 1, 2, 3, 4, 5];

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

function percentOf(part, whole) {
  return whole === 0 ? 0 : roundToOneDecimal((part / whole) * 100);
}

function average(values) {
  return values.length === 0
    ? null
    : roundToOneDecimal(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function blockOccupancy(block, containerSizes) {
  const teuCapacity = slotCount(block) * TEU_PER_SLOT[block.sizeClass];
  const teuUsed = containerSizes.reduce((sum, size) => sum + TEU_BY_SIZE[size], 0);
  return {
    code: block.code,
    type: block.type,
    sizeClass: block.sizeClass,
    capacitySlots: slotCount(block),
    usedSlots: containerSizes.length,
    teuCapacity,
    teuUsed,
    occupancyPercent: percentOf(teuUsed, teuCapacity),
  };
}

export function yardOccupancy(blockReports) {
  const teuCapacity = blockReports.reduce((sum, block) => sum + block.teuCapacity, 0);
  const teuUsed = blockReports.reduce((sum, block) => sum + block.teuUsed, 0);
  return {
    containersInYard: blockReports.reduce((sum, block) => sum + block.usedSlots, 0),
    teuUsed,
    teuCapacity,
    percent: percentOf(teuUsed, teuCapacity),
  };
}

export function dwellDays(gateInAt, until) {
  return (until.getTime() - gateInAt.getTime()) / DAY_MS;
}

export function averageDwellDays(gateInTimes, now) {
  return average(gateInTimes.map((gateInAt) => dwellDays(gateInAt, now)));
}

export function dailyGateMoves(transactions, { today, days }) {
  const series = Array.from({ length: days }, (_, index) => ({
    date: formatCalendarDate(addCalendarDays(today, index - days + 1)),
    in: 0,
    out: 0,
  }));
  const byDate = new Map(series.map((day) => [day.date, day]));
  for (const transaction of transactions) {
    const day = byDate.get(formatCalendarDate(terminalDateOf(transaction.createdAt)));
    if (day) {
      day[transaction.direction === 'IN' ? 'in' : 'out'] += 1;
    }
  }
  return series;
}

export function weekStartOf(calendarDate) {
  return addCalendarDays(calendarDate, -DAYS_FROM_MONDAY[weekdayOf(calendarDate)]);
}

export function weeklyDwell(departures, { today, weeks }) {
  const currentWeek = weekStartOf(today);
  const series = Array.from({ length: weeks }, (_, index) => ({
    weekStart: formatCalendarDate(addCalendarDays(currentWeek, (index - weeks + 1) * 7)),
    dwells: [],
  }));
  const byWeek = new Map(series.map((week) => [week.weekStart, week]));
  for (const { gateInAt, departedAt } of departures) {
    const week = byWeek.get(formatCalendarDate(weekStartOf(terminalDateOf(departedAt))));
    if (week) {
      week.dwells.push(dwellDays(gateInAt, departedAt));
    }
  }
  return series.map(({ weekStart, dwells }) => ({
    weekStart,
    departures: dwells.length,
    averageDwellDays: average(dwells),
  }));
}

export function oldestAgeMinutes(createdTimes, now) {
  if (createdTimes.length === 0) {
    return null;
  }
  const oldest = Math.min(...createdTimes.map((time) => time.getTime()));
  return Math.floor((now.getTime() - oldest) / 60000);
}
