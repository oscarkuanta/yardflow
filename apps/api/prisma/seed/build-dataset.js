import {
  formatCalendarDate,
  getTerminalParts,
  terminalDateOf,
} from '../../src/lib/terminal-time.js';
import { addActiveBookings } from './build-bookings.js';
import { addCustomsHolds } from './build-customs-holds.js';
import { addNotifications } from './build-notifications.js';
import { addReferenceData } from './build-reference-data.js';
import { addVesselVisits } from './build-vessels.js';
import { addYard } from './build-yard.js';
import { createRandom } from './random.js';
import { RANDOM_SEED } from './reference-data.js';
import { createSeedContext } from './seed-context.js';

function byCreationTime(first, second) {
  return first.createdAt - second.createdAt || first.id - second.id;
}

function assignRunningNumbers(rows, periodKeyOf, formatNumber) {
  const lastNumberByPeriod = new Map();
  for (const row of [...rows].sort(byCreationTime)) {
    const periodKey = periodKeyOf(row.createdAt);
    const runningNumber = (lastNumberByPeriod.get(periodKey) ?? 0) + 1;
    lastNumberByPeriod.set(periodKey, runningNumber);
    formatNumber(row, periodKey, runningNumber);
  }
}

function assignReferences(context) {
  assignRunningNumbers(
    context.tables.preAdvices,
    (createdAt) => formatCalendarDate(terminalDateOf(createdAt), ''),
    (preAdvice, day, runningNumber) => {
      preAdvice.reference = `PA-${day}-${String(runningNumber).padStart(4, '0')}`;
    },
  );
  assignRunningNumbers(
    context.tables.storageInvoices,
    (createdAt) => String(getTerminalParts(createdAt).year),
    (invoice, year, runningNumber) => {
      invoice.number = `INV-${year}-${String(runningNumber).padStart(5, '0')}`;
    },
  );
}

function describeDemo(context, demo) {
  const positionOf = (container) => context.containerInfo.get(container.id)?.positionCode ?? null;
  const describeBooking = ({ preAdvice, container, pin }) => ({
    reference: preAdvice.reference,
    type: preAdvice.type,
    pin,
    truckPlate: preAdvice.truckPlate,
    driverName: preAdvice.driverName,
    containerNumber: container.number,
    positionCode: positionOf(container),
  });
  return {
    slotStart: demo.slot.start,
    slotEnd: demo.slot.end,
    pickup: describeBooking(demo.pickup),
    delivery: describeBooking(demo.delivery),
  };
}

export function buildDataset({ now, seed = RANDOM_SEED }) {
  const context = createSeedContext({ now, random: createRandom(seed) });
  addReferenceData(context);
  const yard = addYard(context);
  addVesselVisits(context, yard);
  addCustomsHolds(context);
  const bookings = addActiveBookings(context);
  assignReferences(context);
  addNotifications(context, { pickups: bookings.pickups, dischargedToday: yard.dischargedToday });
  return {
    tables: context.tables,
    stacks: yard.stacks,
    demo: describeDemo(context, bookings.demo),
  };
}
