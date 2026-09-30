import { describe, expect, test } from '@jest/globals';
import {
  formatPositionCode,
  isValidContainerNumber,
  requiredBlockType,
  requiredSizeClass,
} from '@yardflow/shared';
import { calculateStorageFee } from '../../../src/modules/billing/storage-fee.js';
import {
  addCalendarDays,
  formatCalendarDate,
  terminalDateOf,
  terminalDateTime,
  weekdayOf,
} from '../../../src/lib/terminal-time.js';
import { buildDataset } from '../../../prisma/seed/build-dataset.js';
import { DEMO_DELIVERY, DEMO_PICKUP, VESSEL_VISITS } from '../../../prisma/seed/reference-data.js';
import { summarizeDataset } from '../../../prisma/seed/run-seed.js';

const SCENARIOS = [
  ['a weekday inside gate hours', '2026-09-30T08:20:00Z'],
  ['a weekday before the gate opens', '2026-09-30T03:30:00Z'],
  ['a Saturday evening', '2026-10-03T19:00:00Z'],
  ['a Monday in winter time', '2026-11-02T10:05:00Z'],
];

function indexBy(rows, key) {
  return new Map(rows.map((row) => [row[key], row]));
}

function countBy(rows, keyOf) {
  const counts = new Map();
  for (const row of rows) {
    counts.set(keyOf(row), (counts.get(keyOf(row)) ?? 0) + 1);
  }
  return counts;
}

describe.each(SCENARIOS)('seed dataset built on %s', (_label, isoNow) => {
  const now = new Date(isoNow);
  const dataset = buildDataset({ now });
  const { tables } = dataset;
  const containersById = indexBy(tables.containers, 'id');
  const containersByNumber = indexBy(tables.containers, 'number');
  const blocksById = indexBy(tables.blocks, 'id');
  const slotsById = indexBy(tables.timeSlots, 'id');
  const companiesByCode = indexBy(tables.companies, 'code');
  const positionsByContainerId = indexBy(tables.containerPositions, 'containerId');
  const positionCodeOf = (position) =>
    formatPositionCode({ blockCode: blocksById.get(position.blockId).code, ...position });
  const slotEnd = (slot) => terminalDateTime(terminalDateOf(slot.date), slot.startHour + 1);
  const today = terminalDateOf(now);

  describe('reference data', () => {
    test('has the 5 companies, 5 users, 6 blocks and 6 tariffs from the spec', () => {
      expect(tables.companies.map((company) => company.code)).toEqual([
        'HNF',
        'NRT',
        'BLX',
        'SEA',
        'ERH',
      ]);
      expect(tables.users).toHaveLength(5);
      expect(tables.blocks.map((block) => block.code).sort()).toEqual([
        'A',
        'B',
        'C',
        'D',
        'E',
        'X',
      ]);
      expect(tables.tariffs).toHaveLength(6);
    });

    test('gives customers a company and staff no company', () => {
      for (const user of tables.users) {
        expect(user.companyId === null).toBe(user.role !== 'CUSTOMER');
      }
    });

    test('gives dangerous goods 3 free days and double the rate of their size', () => {
      for (const tariff of tables.tariffs.filter((candidate) => candidate.isDangerous)) {
        const standard = tables.tariffs.find(
          (candidate) => candidate.size === tariff.size && !candidate.isDangerous,
        );
        expect(standard.freeDays).toBe(5);
        expect(tariff.freeDays).toBe(3);
        expect(tariff.dailyRateCents).toBe(standard.dailyRateCents * 2);
      }
    });

    test('puts blocks A and D closest to the gate', () => {
      const distances = [...tables.blocks]
        .sort((first, second) => first.gateDistanceM - second.gateDistanceM)
        .map((block) => block.code);
      expect(distances.slice(0, 2).sort()).toEqual(['A', 'D']);
    });
  });

  describe('containers and yard', () => {
    test('uses only valid and unique ISO 6346 container numbers', () => {
      const numbers = [
        ...tables.containers.map((container) => container.number),
        ...tables.preAdvices.map((preAdvice) => preAdvice.containerNumber),
      ];
      for (const number of numbers) {
        expect(isValidContainerNumber(number)).toBe(true);
      }
      expect(containersByNumber.size).toBe(tables.containers.length);
    });

    test('gives a position to every IN_YARD container and to no other', () => {
      for (const container of tables.containers) {
        expect(positionsByContainerId.has(container.id)).toBe(container.state === 'IN_YARD');
      }
    });

    test('reaches about 65 percent TEU occupancy', () => {
      const summary = summarizeDataset(dataset);
      expect(summary.occupancyPercent).toBeGreaterThanOrEqual(63);
      expect(summary.occupancyPercent).toBeLessThanOrEqual(67);
    });

    test('obeys every stacking rule', () => {
      const stacks = Map.groupBy(
        tables.containerPositions,
        (position) => `${position.blockId}-${position.row}-${position.bay}`,
      );
      for (const positions of stacks.values()) {
        const block = blocksById.get(positions[0].blockId);
        const containers = positions.map((position) => containersById.get(position.containerId));
        expect(positions.map((position) => position.tier).sort()).toEqual(
          positions.map((_, index) => index + 1),
        );
        expect(positions.length).toBeLessThanOrEqual(block.maxTier);
        expect(new Set(containers.map((container) => container.size)).size).toBe(1);
        for (const [index, container] of containers.entries()) {
          expect(requiredBlockType(container)).toBe(block.type);
          expect(requiredSizeClass(container)).toBe(block.sizeClass);
          expect(positions[index].row).toBeLessThanOrEqual(block.rows);
          expect(positions[index].bay).toBeLessThanOrEqual(block.bays);
        }
      }
    });

    test('places later arrivals on top of earlier ones', () => {
      const stacks = Map.groupBy(
        tables.containerPositions,
        (position) => `${position.blockId}-${position.row}-${position.bay}`,
      );
      for (const positions of stacks.values()) {
        const arrivals = [...positions]
          .sort((first, second) => first.tier - second.tier)
          .map((position) => containersById.get(position.containerId).gateInAt.getTime());
        expect(arrivals).toEqual([...arrivals].sort((first, second) => first - second));
      }
    });

    test('keeps dangerous goods in block X only', () => {
      for (const position of tables.containerPositions) {
        const container = containersById.get(position.containerId);
        expect(blocksById.get(position.blockId).code === 'X').toBe(container.isDangerous);
      }
    });

    test('spreads gate-in dates over the last 12 days and some are past free days', () => {
      const earliestAllowed = terminalDateTime(addCalendarDays(today, -12), 0);
      const inYard = tables.containers.filter((container) => container.state === 'IN_YARD');
      for (const container of inYard) {
        expect(container.gateInAt >= earliestAllowed).toBe(true);
        expect(container.gateInAt <= now).toBe(true);
      }
      const pastFreeDays = inYard.filter(
        (container) => now - container.gateInAt > 6 * 24 * 60 * 60 * 1000,
      );
      expect(pastFreeDays.length).toBeGreaterThan(50);
    });

    test('records an arrival movement that ends at the current position', () => {
      const arrivals = Map.groupBy(
        tables.movements.filter((movement) => ['GATE_IN', 'DISCHARGE'].includes(movement.type)),
        (movement) => movement.containerId,
      );
      for (const position of tables.containerPositions) {
        const [arrival] = arrivals.get(position.containerId);
        expect(arrival.toPosition).toBe(positionCodeOf(position));
      }
    });

    test('marks departed containers with a departure time and a GATE_OUT or LOAD movement', () => {
      const departureMovements = Map.groupBy(
        tables.movements.filter((movement) => ['GATE_OUT', 'LOAD'].includes(movement.type)),
        (movement) => movement.containerId,
      );
      for (const container of tables.containers.filter((item) => item.state === 'DEPARTED')) {
        expect(container.departedAt).not.toBeNull();
        expect(container.departedAt > container.gateInAt).toBe(true);
        expect(departureMovements.get(container.id)).toHaveLength(1);
      }
    });
  });

  describe('vessel visits', () => {
    const itemsByVisit = Map.groupBy(tables.vesselVisitItems, (item) => item.visitId);

    test.each(VESSEL_VISITS.map((visit) => [visit.vesselName, visit]))(
      '%s has the planned list sizes and done counts',
      (vesselName, definition) => {
        const visit = tables.vesselVisits.find((candidate) => candidate.vesselName === vesselName);
        const items = itemsByVisit.get(visit.id);
        const count = (direction, status) =>
          items.filter(
            (item) => item.direction === direction && (!status || item.status === status),
          ).length;
        expect(visit.status).toBe(definition.status);
        expect(visit.imoNumber).toMatch(/^\d{7}$/);
        expect(count('DISCHARGE')).toBe(definition.discharge.total);
        expect(count('LOAD')).toBe(definition.load.total);
        expect(count('DISCHARGE', 'DONE')).toBe(definition.discharge.done);
        expect(count('LOAD', 'DONE')).toBe(definition.load.done);
      },
    );

    test('Nordic Tern arrived today at 06:40 and leaves today at 21:00', () => {
      const visit = tables.vesselVisits.find((candidate) => candidate.vesselName === 'Nordic Tern');
      expect(visit.ata).toEqual(terminalDateTime(today, 6, 40));
      expect(visit.etd).toEqual(terminalDateTime(today, 21, 0));
    });

    test('links every item to a container in the matching state', () => {
      const expectedState = {
        'DISCHARGE-DONE': 'IN_YARD',
        'DISCHARGE-PENDING': 'EXPECTED',
        'LOAD-DONE': 'DEPARTED',
        'LOAD-PENDING': 'IN_YARD',
      };
      for (const item of tables.vesselVisitItems) {
        const container = containersById.get(item.containerId);
        expect(container.number).toBe(item.containerNumber);
        expect(container.state).toBe(expectedState[`${item.direction}-${item.status}`]);
        expect(item.doneAt === null).toBe(item.status === 'PENDING');
      }
    });

    test('never puts one container on two load lists', () => {
      const loadNumbers = tables.vesselVisitItems
        .filter((item) => item.direction === 'LOAD')
        .map((item) => item.containerNumber);
      expect(new Set(loadNumbers).size).toBe(loadNumbers.length);
    });
  });

  describe('time slots and pre-advices', () => {
    test('creates hourly slots from 08:00 to 16:00, never on Sunday, for the next 14 days', () => {
      for (const slot of tables.timeSlots) {
        expect(weekdayOf(terminalDateOf(slot.date))).not.toBe(0);
        expect(slot.startHour).toBeGreaterThanOrEqual(8);
        expect(slot.startHour).toBeLessThanOrEqual(16);
      }
      const lastDate = formatCalendarDate(addCalendarDays(today, 14));
      const lastDay = addCalendarDays(today, 14);
      const hasLastDay = tables.timeSlots.some(
        (slot) => formatCalendarDate(terminalDateOf(slot.date)) === lastDate,
      );
      expect(hasLastDay).toBe(weekdayOf(lastDay) !== 0);
    });

    test('never books a slot beyond its capacity with ACTIVE and USED pre-advices', () => {
      const bookings = countBy(
        tables.preAdvices.filter((preAdvice) => ['ACTIVE', 'USED'].includes(preAdvice.status)),
        (preAdvice) => preAdvice.timeSlotId,
      );
      for (const [slotId, count] of bookings) {
        expect(count).toBeLessThanOrEqual(slotsById.get(slotId).capacity);
      }
    });

    test('uses unique references in the format PA-YYYYMMDD-NNNN', () => {
      const references = tables.preAdvices.map((preAdvice) => preAdvice.reference);
      for (const reference of references) {
        expect(reference).toMatch(/^PA-\d{8}-\d{4}$/);
      }
      expect(new Set(references).size).toBe(references.length);
    });

    test('has at most one ACTIVE pre-advice per container', () => {
      const active = tables.preAdvices.filter((preAdvice) => preAdvice.status === 'ACTIVE');
      const numbers = active.map((preAdvice) => preAdvice.containerNumber);
      expect(new Set(numbers).size).toBe(numbers.length);
    });

    test('has ACTIVE pre-advices only in open slots, spread over the next two operating days', () => {
      const active = tables.preAdvices.filter((preAdvice) => preAdvice.status === 'ACTIVE');
      for (const preAdvice of active) {
        expect(slotEnd(slotsById.get(preAdvice.timeSlotId)) > now).toBe(true);
      }
      const bookedDays = new Set(
        active.map((preAdvice) => slotsById.get(preAdvice.timeSlotId).date.toISOString()),
      );
      expect(bookedDays.size).toBe(2);
    });

    test('links ACTIVE pickups to IN_YARD containers of the same company', () => {
      const pickups = tables.preAdvices.filter(
        (preAdvice) => preAdvice.status === 'ACTIVE' && preAdvice.type === 'PICKUP',
      );
      expect(pickups.length).toBeGreaterThan(1);
      for (const preAdvice of pickups) {
        const container = containersByNumber.get(preAdvice.containerNumber);
        expect(container.state).toBe('IN_YARD');
        expect(container.ownerCompanyId).toBe(preAdvice.companyId);
        expect(preAdvice.size).toBeNull();
      }
    });

    test('gives ACTIVE deliveries full container data and no container in the yard', () => {
      const deliveries = tables.preAdvices.filter(
        (preAdvice) => preAdvice.status === 'ACTIVE' && preAdvice.type === 'DELIVERY',
      );
      for (const preAdvice of deliveries) {
        expect(containersByNumber.get(preAdvice.containerNumber).state).toBe('EXPECTED');
        expect(preAdvice.size).not.toBeNull();
        expect(preAdvice.loadStatus).not.toBeNull();
        expect(preAdvice.grossWeightKg).not.toBeNull();
      }
    });

    test('has some cancelled pre-advices', () => {
      expect(tables.preAdvices.some((preAdvice) => preAdvice.status === 'CANCELLED')).toBe(true);
    });
  });

  describe('gate history', () => {
    test('has 60 to 90 gate moves on each past Monday to Friday', () => {
      const movesPerDay = countBy(tables.gateTransactions, (transaction) =>
        formatCalendarDate(terminalDateOf(transaction.createdAt)),
      );
      for (let dayOffset = -14; dayOffset <= -1; dayOffset += 1) {
        const day = addCalendarDays(today, dayOffset);
        if (weekdayOf(day) >= 1 && weekdayOf(day) <= 5) {
          const moves = movesPerDay.get(formatCalendarDate(day));
          expect(moves).toBeGreaterThanOrEqual(60);
          expect(moves).toBeLessThanOrEqual(90);
        }
      }
    });

    test('links every gate transaction to a USED pre-advice of the matching type', () => {
      const preAdvicesById = indexBy(tables.preAdvices, 'id');
      for (const transaction of tables.gateTransactions) {
        const preAdvice = preAdvicesById.get(transaction.preAdviceId);
        expect(preAdvice.status).toBe('USED');
        expect(preAdvice.type).toBe(transaction.direction === 'IN' ? 'DELIVERY' : 'PICKUP');
        expect(preAdvice.containerNumber).toBe(containersById.get(transaction.containerId).number);
        const slot = slotsById.get(preAdvice.timeSlotId);
        expect(transaction.createdAt < slotEnd(slot)).toBe(true);
      }
    });

    test('records damage only on transactions without the no damage flag', () => {
      const damagedIds = new Set(tables.damageReports.map((report) => report.gateTransactionId));
      for (const transaction of tables.gateTransactions) {
        expect(damagedIds.has(transaction.id)).toBe(!transaction.noDamage);
      }
    });
  });

  describe('customs holds and invoices', () => {
    test('has 5 active and 3 released holds, at most one active per container', () => {
      const active = tables.customsHolds.filter((hold) => hold.releasedAt === null);
      const released = tables.customsHolds.filter((hold) => hold.releasedAt !== null);
      expect(active).toHaveLength(5);
      expect(released).toHaveLength(3);
      expect(new Set(active.map((hold) => hold.containerId)).size).toBe(5);
      for (const hold of active) {
        expect(['EXPECTED', 'IN_YARD']).toContain(containersById.get(hold.containerId).state);
      }
    });

    test('never puts an active hold on a container with an active pickup', () => {
      const activePickupNumbers = new Set(
        tables.preAdvices
          .filter((preAdvice) => preAdvice.status === 'ACTIVE' && preAdvice.type === 'PICKUP')
          .map((preAdvice) => preAdvice.containerNumber),
      );
      for (const hold of tables.customsHolds.filter((candidate) => candidate.releasedAt === null)) {
        expect(activePickupNumbers.has(containersById.get(hold.containerId).number)).toBe(false);
      }
    });

    test('has paid, unpaid and zero-amount invoices', () => {
      const statuses = new Set(tables.storageInvoices.map((invoice) => invoice.status));
      expect(statuses).toEqual(new Set(['PAID', 'UNPAID']));
      expect(tables.storageInvoices.some((invoice) => invoice.amountCents === 0)).toBe(true);
    });

    test('computes every invoice with the storage fee rules and marks free ones paid', () => {
      for (const invoice of tables.storageInvoices) {
        const container = containersById.get(invoice.containerId);
        const tariff = tables.tariffs.find(
          (candidate) =>
            candidate.size === container.size && candidate.isDangerous === container.isDangerous,
        );
        expect(invoice).toMatchObject(
          calculateStorageFee(invoice.periodFrom, invoice.periodTo, tariff),
        );
        if (invoice.amountCents === 0) {
          expect(invoice.status).toBe('PAID');
          expect(invoice.paidMarkedById).toBeNull();
        }
      }
    });

    test('uses unique invoice numbers in the format INV-YYYY-NNNNN', () => {
      const numbers = tables.storageInvoices.map((invoice) => invoice.number);
      for (const number of numbers) {
        expect(number).toMatch(/^INV-\d{4}-\d{5}$/);
      }
      expect(new Set(numbers).size).toBe(numbers.length);
    });
  });

  describe('demo bookings', () => {
    test('has a pickup whose container has exactly 2 containers on top', () => {
      const container = containersByNumber.get(DEMO_PICKUP.containerNumber);
      const position = positionsByContainerId.get(container.id);
      const stackHeight = tables.containerPositions.filter(
        (candidate) =>
          candidate.blockId === position.blockId &&
          candidate.row === position.row &&
          candidate.bay === position.bay,
      ).length;
      expect(position.tier).toBe(1);
      expect(stackHeight).toBe(3);
      expect(dataset.demo.pickup.positionCode).toBe(positionCodeOf(position));
      expect(container.ownerCompanyId).toBe(companiesByCode.get('HNF').id);
    });

    test('lets the demo pickup pass the customs and invoice checks', () => {
      const container = containersByNumber.get(DEMO_PICKUP.containerNumber);
      const activeHolds = tables.customsHolds.filter(
        (hold) => hold.containerId === container.id && hold.releasedAt === null,
      );
      const invoice = tables.storageInvoices.find(
        (candidate) => candidate.containerId === container.id,
      );
      expect(activeHolds).toHaveLength(0);
      expect(invoice.status).toBe('PAID');
      expect(invoice.periodTo > now).toBe(true);
    });

    test('books the demo pickup and delivery with the fixed PINs in the current or next slot', () => {
      const pickup = tables.preAdvices.find(
        (item) => item.reference === dataset.demo.pickup.reference,
      );
      const delivery = tables.preAdvices.find(
        (item) => item.reference === dataset.demo.delivery.reference,
      );
      expect(pickup).toMatchObject({ type: 'PICKUP', status: 'ACTIVE', pin: DEMO_PICKUP.pin });
      expect(delivery).toMatchObject({
        type: 'DELIVERY',
        status: 'ACTIVE',
        pin: DEMO_DELIVERY.pin,
      });
      expect(pickup.truckPlate).toBe(DEMO_PICKUP.truckPlate);
      expect(dataset.demo.slotEnd > now).toBe(true);
      const earlierOpenSlots = tables.timeSlots.filter((slot) => {
        const end = slotEnd(slot);
        return end > now && end < dataset.demo.slotEnd;
      });
      expect(earlierOpenSlots).toHaveLength(0);
    });
  });

  describe('notifications', () => {
    test('are sent to the company that owns the container', () => {
      expect(tables.notifications.length).toBeGreaterThan(0);
      for (const notification of tables.notifications) {
        const container = containersByNumber.get(notification.containerNumber);
        expect(notification.companyId).toBe(container.ownerCompanyId);
      }
    });

    test('include unread alerts for the HNF demo customer', () => {
      const unread = tables.notifications.filter(
        (notification) =>
          notification.companyId === companiesByCode.get('HNF').id && notification.readAt === null,
      );
      expect(unread.length).toBeGreaterThan(0);
    });
  });

  test('never writes a time after now into history fields', () => {
    const historyFields = [
      ...tables.containers.flatMap((row) => [row.createdAt, row.gateInAt, row.departedAt]),
      ...tables.movements.map((row) => row.createdAt),
      ...tables.gateTransactions.map((row) => row.createdAt),
      ...tables.preAdvices.map((row) => row.createdAt),
      ...tables.vesselVisitItems.map((row) => row.doneAt),
      ...tables.customsHolds.flatMap((row) => [row.placedAt, row.releasedAt]),
      ...tables.storageInvoices.flatMap((row) => [row.createdAt, row.paidAt]),
      ...tables.notifications.flatMap((row) => [row.createdAt, row.readAt]),
    ].filter(Boolean);
    for (const moment of historyFields) {
      expect(moment <= now).toBe(true);
    }
  });

  test('is identical when built twice with the same time', () => {
    expect(JSON.stringify(buildDataset({ now }))).toBe(JSON.stringify(dataset));
  });
});
