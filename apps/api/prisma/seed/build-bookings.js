import { MINUTE_MS } from '../../src/lib/terminal-time.js';
import { buildProfile, randomPin, randomProfile } from './container-factory.js';
import { DEMO_DELIVERY, DEMO_PICKUP } from './reference-data.js';
import {
  addContainer,
  addInvoice,
  addPreAdvice,
  companyByCode,
  findOne,
  flagContainer,
  hasFlag,
  hoursAfter,
  hoursBefore,
  laterOf,
  randomOwnerId,
  randomTimeBetween,
  roleOf,
} from './seed-context.js';

const CANCELLED_BOOKING_COUNT = 3;
const BOOKED_OPERATING_DAYS = 2;
const PAID_INVOICE_PROBABILITY = 0.6;
const EXCLUDED_PICKUP_FLAGS = ['DEMO', 'HOLD', 'LOAD_LIST', 'ACTIVE_PICKUP'];

function minutesBefore(date, minutes) {
  return new Date(date.getTime() - minutes * MINUTE_MS);
}

function pickupCandidates(context) {
  return context.random.shuffle(
    context.tables.containers.filter(
      (container) =>
        container.state === 'IN_YARD' &&
        roleOf(context, container) === 'IMPORT' &&
        container.gateInAt < hoursBefore(context.now, 3) &&
        EXCLUDED_PICKUP_FLAGS.every((flag) => !hasFlag(context, container, flag)),
    ),
  );
}

function addPickup(context, { container, slot, createdAt, pin, truck, paidAt }) {
  flagContainer(context, container, 'ACTIVE_PICKUP');
  const preAdvice = addPreAdvice(context, {
    type: 'PICKUP',
    container,
    slot,
    status: 'ACTIVE',
    pin,
    createdAt,
    truck,
  });
  const invoice = addInvoice(context, { container, periodTo: slot.end, createdAt, paidAt });
  return { preAdvice, invoice, container };
}

function addRandomPickup(context, container, slot) {
  const createdAt = randomTimeBetween(
    context,
    laterOf(hoursAfter(container.gateInAt, 1), hoursBefore(context.now, 30)),
    minutesBefore(context.now, 10),
  );
  const paidAt = context.random.chance(PAID_INVOICE_PROBABILITY)
    ? randomTimeBetween(context, createdAt, minutesBefore(context.now, 5))
    : null;
  return addPickup(context, { container, slot, createdAt, pin: randomPin(context.random), paidAt });
}

function addDelivery(context, { slot, profile, ownerCompanyId, createdAt, pin, truck }) {
  const container = addContainer(context, {
    profile,
    ownerCompanyId,
    state: 'EXPECTED',
    role: 'EXPORT',
    createdAt,
  });
  const preAdvice = addPreAdvice(context, {
    type: 'DELIVERY',
    container,
    slot,
    status: 'ACTIVE',
    pin,
    createdAt,
    truck,
  });
  return { preAdvice, container };
}

function addRandomDelivery(context, slot) {
  return addDelivery(context, {
    slot,
    profile: randomProfile(context.random),
    ownerCompanyId: randomOwnerId(context),
    createdAt: randomTimeBetween(
      context,
      hoursBefore(context.now, 30),
      minutesBefore(context.now, 10),
    ),
    pin: randomPin(context.random),
  });
}

function addDemoBookings(context, slot) {
  const pickupContainer = findOne(
    context.tables.containers,
    (container) => container.number === DEMO_PICKUP.containerNumber,
  );
  const pickupCreatedAt = hoursBefore(context.now, 3);
  const pickup = addPickup(context, {
    container: pickupContainer,
    slot,
    createdAt: pickupCreatedAt,
    pin: DEMO_PICKUP.pin,
    truck: DEMO_PICKUP,
    paidAt: hoursAfter(pickupCreatedAt, 0.5),
  });
  const delivery = addDelivery(context, {
    slot,
    profile: buildProfile(context.random, { size: 'FT40', loadStatus: 'FULL', isDangerous: false }),
    ownerCompanyId: companyByCode(context, DEMO_DELIVERY.companyCode).id,
    createdAt: hoursBefore(context.now, 5),
    pin: DEMO_DELIVERY.pin,
    truck: DEMO_DELIVERY,
  });
  return {
    slot,
    pickup: { ...pickup, pin: DEMO_PICKUP.pin },
    delivery: { ...delivery, pin: DEMO_DELIVERY.pin },
  };
}

function addCancelledBookings(context, slots) {
  for (let index = 0; index < CANCELLED_BOOKING_COUNT; index += 1) {
    const ownerCompanyId = randomOwnerId(context);
    const companyCode = findOne(
      context.tables.companies,
      (company) => company.id === ownerCompanyId,
    ).code;
    addPreAdvice(context, {
      type: 'DELIVERY',
      container: {
        number: context.nextContainerNumber(companyCode),
        ownerCompanyId,
        ...randomProfile(context.random),
      },
      slot: context.random.pick(slots),
      status: 'CANCELLED',
      pin: randomPin(context.random),
      createdAt: randomTimeBetween(
        context,
        hoursBefore(context.now, 30),
        minutesBefore(context.now, 10),
      ),
    });
  }
}

function nextOperatingDaysSlots(context, dayCount) {
  const openSlots = context.slots.filter((slot) => slot.end > context.now);
  const dayOffsets = [...new Set(openSlots.map((slot) => slot.dayOffset))].slice(0, dayCount);
  return openSlots.filter((slot) => dayOffsets.includes(slot.dayOffset));
}

export function addActiveBookings(context) {
  const demoSlot = context.slots.find((slot) => slot.end > context.now);
  const demo = addDemoBookings(context, demoSlot);
  const candidates = pickupCandidates(context);
  const pickups = [demo.pickup];
  const bookableSlots = nextOperatingDaysSlots(context, BOOKED_OPERATING_DAYS);
  for (const slot of bookableSlots) {
    const count = Math.min(context.random.integer(2, 5), slot.row.capacity - slot.bookedCount);
    for (let index = 0; index < count; index += 1) {
      if (context.random.chance(0.5) && candidates.length > 0) {
        pickups.push(addRandomPickup(context, candidates.pop(), slot));
      } else {
        addRandomDelivery(context, slot);
      }
    }
  }
  addCancelledBookings(context, bookableSlots);
  return { demo, pickups };
}
