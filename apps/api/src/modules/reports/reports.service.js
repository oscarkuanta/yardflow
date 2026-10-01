import { FIRST_SLOT_HOUR, LAST_SLOT_HOUR } from '../../config/terminal.js';
import {
  addCalendarDays,
  calendarDateToDbDate,
  getTerminalParts,
  terminalDateOf,
  terminalDateTime,
} from '../../lib/terminal-time.js';
import {
  averageDwellDays,
  blockOccupancy,
  dailyGateMoves,
  oldestAgeMinutes,
  weekStartOf,
  weeklyDwell,
  yardOccupancy,
} from './report-calculations.js';
import { DWELL_WEEKS } from './reports.schemas.js';

export function createReportsService({ prisma, clock }) {
  async function occupancyByBlock() {
    const [blocks, positions] = await Promise.all([
      prisma.block.findMany({ orderBy: { code: 'asc' } }),
      prisma.containerPosition.findMany({
        select: { blockId: true, container: { select: { size: true } } },
      }),
    ]);
    return blocks.map((block) =>
      blockOccupancy(
        block,
        positions
          .filter((position) => position.blockId === block.id)
          .map((position) => position.container.size),
      ),
    );
  }

  async function gateMovesToday(now) {
    const today = terminalDateOf(now);
    const groups = await prisma.gateTransaction.groupBy({
      by: ['direction'],
      where: {
        createdAt: {
          gte: terminalDateTime(today, 0),
          lt: terminalDateTime(addCalendarDays(today, 1), 0),
        },
      },
      _count: { _all: true },
    });
    const countOf = (direction) =>
      groups.find((group) => group.direction === direction)?._count._all ?? 0;
    return { in: countOf('IN'), out: countOf('OUT'), total: countOf('IN') + countOf('OUT') };
  }

  async function currentSlot(now) {
    const { hour } = getTerminalParts(now);
    if (hour < FIRST_SLOT_HOUR || hour > LAST_SLOT_HOUR) {
      return null;
    }
    const today = terminalDateOf(now);
    const slot = await prisma.timeSlot.findUnique({
      where: { date_startHour: { date: calendarDateToDbDate(today), startHour: hour } },
    });
    if (!slot) {
      return null;
    }
    const expectedTrucks = await prisma.preAdvice.count({
      where: { timeSlotId: slot.id, status: 'ACTIVE' },
    });
    return {
      startsAt: terminalDateTime(today, hour),
      endsAt: terminalDateTime(today, hour + 1),
      expectedTrucks,
    };
  }

  async function openWorkOrders(now) {
    const orders = await prisma.workOrder.findMany({
      where: { status: 'OPEN' },
      select: { createdAt: true },
    });
    return {
      count: orders.length,
      oldestAgeMinutes: oldestAgeMinutes(
        orders.map((order) => order.createdAt),
        now,
      ),
    };
  }

  async function kpis() {
    const now = clock();
    const [blocks, gateMoves, slot, workOrders, activeHolds, inYard] = await Promise.all([
      occupancyByBlock(),
      gateMovesToday(now),
      currentSlot(now),
      openWorkOrders(now),
      prisma.customsHold.count({ where: { releasedAt: null } }),
      prisma.container.findMany({ where: { state: 'IN_YARD' }, select: { gateInAt: true } }),
    ]);
    return {
      occupancy: yardOccupancy(blocks),
      gateMovesToday: gateMoves,
      currentSlot: slot,
      openWorkOrders: workOrders,
      activeHolds,
      averageDwellDays: averageDwellDays(
        inYard.map((container) => container.gateInAt).filter(Boolean),
        now,
      ),
      generatedAt: now,
    };
  }

  async function gateMoves(days) {
    const today = terminalDateOf(clock());
    const transactions = await prisma.gateTransaction.findMany({
      where: { createdAt: { gte: terminalDateTime(addCalendarDays(today, 1 - days), 0) } },
      select: { direction: true, createdAt: true },
    });
    return dailyGateMoves(transactions, { today, days });
  }

  async function dwell() {
    const today = terminalDateOf(clock());
    const firstWeek = addCalendarDays(weekStartOf(today), (1 - DWELL_WEEKS) * 7);
    const departures = await prisma.container.findMany({
      where: {
        state: 'DEPARTED',
        gateInAt: { not: null },
        departedAt: { gte: terminalDateTime(firstWeek, 0) },
      },
      select: { gateInAt: true, departedAt: true },
    });
    return weeklyDwell(departures, { today, weeks: DWELL_WEEKS });
  }

  return { kpis, occupancyByBlock, gateMoves, dwell };
}
