import { Prisma } from '@prisma/client';
import { BOOKING_HORIZON_DAYS } from '../../config/terminal.js';
import { conflict, notFound, validationFailed } from '../../lib/errors.js';
import {
  calendarDateToDbDate,
  formatCalendarDate,
  parseCalendarDate,
  terminalDateOf,
} from '../../lib/terminal-time.js';
import {
  SLOT_START_HOURS,
  isBeyondHorizon,
  isInCreationWindow,
  isOperatingDay,
  presentSlot,
  slotsBookedBeyond,
} from './slot-calendar.js';

export const BOOKING_STATUSES = ['ACTIVE', 'USED'];

export function createTimeSlotsService({ prisma, auditService, clock, defaultSlotCapacity }) {
  function today() {
    return terminalDateOf(clock());
  }

  function assertWithinHorizon(calendarDate, field) {
    if (isBeyondHorizon(calendarDate, today())) {
      throw validationFailed([
        { field, message: `Time slots exist only up to ${BOOKING_HORIZON_DAYS} days ahead` },
      ]);
    }
  }

  async function ensureSlotsForDate(calendarDate, client) {
    if (!isOperatingDay(calendarDate) || !isInCreationWindow(calendarDate, today())) {
      return;
    }
    await client.timeSlot.createMany({
      data: SLOT_START_HOURS.map((startHour) => ({
        date: calendarDateToDbDate(calendarDate),
        startHour,
        capacity: defaultSlotCapacity,
      })),
      skipDuplicates: true,
    });
  }

  async function bookedCountsFor(slotIds, client) {
    const groups = await client.preAdvice.groupBy({
      by: ['timeSlotId'],
      where: { timeSlotId: { in: slotIds }, status: { in: BOOKING_STATUSES } },
      _count: { _all: true },
    });
    return new Map(groups.map((group) => [group.timeSlotId, group._count._all]));
  }

  async function slotsOfDate(calendarDate, client) {
    return client.timeSlot.findMany({
      where: { date: calendarDateToDbDate(calendarDate) },
      orderBy: { startHour: 'asc' },
    });
  }

  async function listForDate(dateText) {
    const calendarDate = parseCalendarDate(dateText);
    assertWithinHorizon(calendarDate, 'query.date');
    await ensureSlotsForDate(calendarDate, prisma);
    const slots = await slotsOfDate(calendarDate, prisma);
    const bookedCounts = await bookedCountsFor(
      slots.map((slot) => slot.id),
      prisma,
    );
    return slots.map((slot) => presentSlot(slot, bookedCounts.get(slot.id) ?? 0));
  }

  async function findTargetSlots({ slotId, date }, transaction) {
    if (slotId !== undefined) {
      const slot = await transaction.timeSlot.findUnique({ where: { id: slotId } });
      if (!slot) {
        throw notFound('Time slot not found');
      }
      return [slot];
    }
    const calendarDate = parseCalendarDate(date);
    assertWithinHorizon(calendarDate, 'body.date');
    if (!isOperatingDay(calendarDate)) {
      throw validationFailed([{ field: 'body.date', message: 'The gate is closed on Sundays' }]);
    }
    await ensureSlotsForDate(calendarDate, transaction);
    return slotsOfDate(calendarDate, transaction);
  }

  async function lockSlots(slotIds, transaction) {
    await transaction.$queryRaw`SELECT id FROM TimeSlot WHERE id IN (${Prisma.join(slotIds)}) FOR UPDATE`;
  }

  function assertCapacityFitsBookings(slots, bookedCounts, capacity) {
    const overbooked = slotsBookedBeyond(slots, bookedCounts, capacity);
    if (overbooked.length > 0) {
      throw conflict(
        'CAPACITY_BELOW_BOOKINGS',
        'Capacity cannot be lower than the number of bookings in a slot',
        overbooked.map(({ slot, booked }) => ({
          slotId: slot.id,
          startHour: slot.startHour,
          booked,
        })),
      );
    }
  }

  async function updateCapacity(body, actor) {
    return prisma.$transaction(async (transaction) => {
      const slots = await findTargetSlots(body, transaction);
      if (slots.length === 0) {
        throw notFound('No time slots on this date');
      }
      const slotIds = slots.map((slot) => slot.id);
      await lockSlots(slotIds, transaction);
      const bookedCounts = await bookedCountsFor(slotIds, transaction);
      assertCapacityFitsBookings(slots, bookedCounts, body.capacity);
      await transaction.timeSlot.updateMany({
        where: { id: { in: slotIds } },
        data: { capacity: body.capacity },
      });
      await auditService.record(
        {
          userId: actor.id,
          action: 'UPDATE_CAPACITY',
          entity: 'TimeSlot',
          entityId: body.slotId ?? formatCalendarDate(parseCalendarDate(body.date)),
          before: slots.map(({ id, startHour, capacity }) => ({ id, startHour, capacity })),
          after: { capacity: body.capacity },
          ip: actor.ip,
        },
        transaction,
      );
      return slots.map((slot) =>
        presentSlot({ ...slot, capacity: body.capacity }, bookedCounts.get(slot.id) ?? 0),
      );
    });
  }

  return { listForDate, updateCapacity };
}
