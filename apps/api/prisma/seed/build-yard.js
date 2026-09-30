import { formatPositionCode } from '@yardflow/shared';
import {
  HOUR_MS,
  MINUTE_MS,
  addCalendarDays,
  terminalDateTime,
} from '../../src/lib/terminal-time.js';
import { profileForBlock, randomProfile } from './container-factory.js';
import {
  BLOCKS,
  DEMO_PICKUP,
  RETIRED_PIN,
  TARGET_OCCUPANCY,
  VESSEL_VISITS,
  YARD_DWELL_WINDOW_DAYS,
} from './reference-data.js';
import {
  addContainer,
  addGateTransaction,
  addInvoice,
  addMovement,
  addPreAdvice,
  blockByCode,
  companyByCode,
  flagContainer,
  hoursAfter,
  hoursBefore,
  laterOf,
  randomOwnerId,
  randomPositionCode,
  randomTimeBetween,
  userByRole,
} from './seed-context.js';
import { buildYardLayout, listSlots, stackKey } from './yard-layout.js';

const SATURDAY = 6;
const SEATS_KEPT_FREE_IN_CURRENT_SLOT = 5;
const MIN_IMPORT_DWELL_HOURS = 48;
const MAX_IMPORT_DWELL_HOURS = 20 * 24;
export const DEMO_STACK = { blockCode: DEMO_PICKUP.blockCode, row: 2, bay: 3, size: 'FT40' };
const DEMO_STACK_ARRIVALS = [
  { daysAgo: 8, companyCode: DEMO_PICKUP.companyCode, number: DEMO_PICKUP.containerNumber },
  { daysAgo: 6, companyCode: 'NRT', number: null },
  { daysAgo: 3, companyCode: 'SEA', number: null },
];

export function timeFromToday(context, { dayOffset, hour, minute }) {
  return terminalDateTime(addCalendarDays(context.today, dayOffset), hour, minute);
}

export function todaysVesselWorkWindow(context) {
  const ata = timeFromToday(context, VESSEL_VISITS[0].ata);
  const twoHoursAgo = hoursBefore(context.now, 2);
  return { start: ata < twoHoursAgo ? ata : twoHoursAgo, end: context.now };
}

function gateVisitCount(context, slot) {
  const fullCount =
    slot.weekday === SATURDAY ? context.random.integer(3, 6) : context.random.integer(7, 10);
  if (slot.end <= context.now) {
    return fullCount;
  }
  const elapsedShare = (context.now - slot.start) / HOUR_MS;
  const seatsForHistory = slot.row.capacity - SEATS_KEPT_FREE_IN_CURRENT_SLOT;
  return Math.min(Math.floor(fullCount * elapsedShare), seatsForHistory);
}

function planGateEvents(context) {
  const events = [];
  for (const slot of context.slots.filter((candidate) => candidate.start < context.now)) {
    const count = gateVisitCount(context, slot);
    const latestMinute = Math.max(0, Math.min(59, (context.now - slot.start) / MINUTE_MS - 1));
    for (let index = 0; index < count; index += 1) {
      events.push({
        slot,
        at: new Date(
          slot.start.getTime() + context.random.integer(0, Math.floor(latestMinute)) * MINUTE_MS,
        ),
        direction: context.random.chance(0.5) ? 'IN' : 'OUT',
      });
    }
  }
  return events.sort((first, second) => first.at - second.at);
}

function addUsedGateVisit(context, { event, type, container, createdAt }) {
  const preAdvice = addPreAdvice(context, {
    type,
    container,
    slot: event.slot,
    status: 'USED',
    pin: RETIRED_PIN,
    createdAt,
  });
  return addGateTransaction(context, {
    direction: event.direction,
    preAdvice,
    container,
    at: event.at,
  });
}

function addExportGateIn(context, event, yardSlot) {
  const profile = yardSlot
    ? profileForBlock(
        context.random,
        blockByCode(context, yardSlot.stack.blockCode),
        yardSlot.stack.size,
      )
    : randomProfile(context.random);
  const createdAt = randomTimeBetween(context, hoursBefore(event.at, 40), hoursBefore(event.at, 3));
  const container = addContainer(context, {
    profile,
    ownerCompanyId: randomOwnerId(context),
    state: yardSlot ? 'IN_YARD' : 'DEPARTED',
    role: 'EXPORT',
    gateInAt: event.at,
    createdAt,
  });
  const gateTransaction = addUsedGateVisit(context, {
    event,
    type: 'DELIVERY',
    container,
    createdAt,
  });
  return {
    container,
    arrival: { type: 'GATE_IN', userId: gateTransaction.operatorId, at: event.at },
  };
}

function addDepartedExport(context, event) {
  const { container, arrival } = addExportGateIn(context, event, null);
  const positionCode = randomPositionCode(context, container);
  addMovement(context, { container, toPosition: positionCode, ...arrival });
  context.containerInfo.get(container.id).positionCode = positionCode;
  return container;
}

function loadOntoEarlierVessel(context, container) {
  const startOfToday = terminalDateTime(context.today, 0);
  container.departedAt = randomTimeBetween(
    context,
    hoursAfter(container.gateInAt, 24),
    startOfToday,
  );
  addMovement(context, {
    container,
    type: 'LOAD',
    fromPosition: context.containerInfo.get(container.id).positionCode,
    userId: userByRole(context, 'PLANNER').id,
    at: container.departedAt,
  });
}

function addGateIns(context, gateInEvents, yardPool, assignments) {
  const loadedTodayCount = VESSEL_VISITS[0].load.done;
  const olderThanDwellWindow = (event) => event.slot.dayOffset < -YARD_DWELL_WINDOW_DAYS;
  const earlierEvents = gateInEvents.filter(olderThanDwellWindow);
  const recentPastEvents = context.random.shuffle(
    gateInEvents.filter((event) => !olderThanDwellWindow(event) && event.slot.dayOffset < 0),
  );
  const loadedTodayEvents = recentPastEvents.slice(0, loadedTodayCount);
  const yardEvents = [
    ...recentPastEvents.slice(loadedTodayCount),
    ...gateInEvents.filter((event) => event.slot.dayOffset === 0),
  ];

  for (const event of earlierEvents) {
    loadOntoEarlierVessel(context, addDepartedExport(context, event));
  }
  const loadedToday = loadedTodayEvents.map((event) => addDepartedExport(context, event));
  for (const event of yardEvents) {
    const yardSlot = yardPool.pop();
    assignments.push({ ...addExportGateIn(context, event, yardSlot), yardSlot });
  }
  return loadedToday;
}

function addImportGateOut(context, event) {
  const dwellHours = context.random.integer(MIN_IMPORT_DWELL_HOURS, MAX_IMPORT_DWELL_HOURS);
  const gateInAt = hoursBefore(event.at, dwellHours);
  const container = addContainer(context, {
    profile: randomProfile(context.random),
    ownerCompanyId: randomOwnerId(context),
    state: 'DEPARTED',
    role: 'IMPORT',
    gateInAt,
    departedAt: event.at,
    createdAt: hoursBefore(gateInAt, context.random.integer(24, 120)),
  });
  const positionCode = randomPositionCode(context, container);
  addMovement(context, {
    container,
    type: 'DISCHARGE',
    toPosition: positionCode,
    userId: userByRole(context, 'PLANNER').id,
    at: gateInAt,
  });
  const createdAt = randomTimeBetween(
    context,
    laterOf(hoursAfter(gateInAt, 1), hoursBefore(event.at, 40)),
    hoursBefore(event.at, 3),
  );
  addInvoice(context, {
    container,
    periodTo: event.slot.end,
    createdAt,
    paidAt: randomTimeBetween(context, createdAt, new Date(event.at.getTime() - 30 * MINUTE_MS)),
  });
  const gateTransaction = addUsedGateVisit(context, {
    event,
    type: 'PICKUP',
    container,
    createdAt,
  });
  addMovement(context, {
    container,
    type: 'GATE_OUT',
    fromPosition: positionCode,
    userId: gateTransaction.operatorId,
    at: event.at,
  });
}

function randomPastArrival(context) {
  const calendarDate = addCalendarDays(
    context.today,
    -context.random.integer(1, YARD_DWELL_WINDOW_DAYS),
  );
  return terminalDateTime(
    calendarDate,
    context.random.integer(0, 23),
    context.random.integer(0, 59),
  );
}

function addImport(context, { yardSlot, gateInAt, ownerCompanyId, number }) {
  const block = blockByCode(context, yardSlot.stack.blockCode);
  const container = addContainer(context, {
    profile: profileForBlock(context.random, block, yardSlot.stack.size),
    ownerCompanyId,
    number,
    state: 'IN_YARD',
    role: 'IMPORT',
    gateInAt,
    createdAt: hoursBefore(gateInAt, context.random.integer(24, 120)),
  });
  const arrival = { type: 'DISCHARGE', userId: userByRole(context, 'PLANNER').id, at: gateInAt };
  return { container, arrival, yardSlot };
}

function addYardImports(context, yardPool, assignments) {
  const dischargedTodayCount = VESSEL_VISITS[0].discharge.done;
  const workWindow = todaysVesselWorkWindow(context);
  const dischargedToday = [];
  yardPool.forEach((yardSlot, index) => {
    const isFromTodaysVessel = index < dischargedTodayCount;
    const gateInAt = isFromTodaysVessel
      ? randomTimeBetween(context, workWindow.start, workWindow.end)
      : randomPastArrival(context);
    const assignment = addImport(context, {
      yardSlot,
      gateInAt,
      ownerCompanyId: randomOwnerId(context),
    });
    assignments.push(assignment);
    if (isFromTodaysVessel) {
      dischargedToday.push(assignment.container);
    }
  });
  return dischargedToday;
}

function addDemoStack(context, demoSlots, assignments) {
  DEMO_STACK_ARRIVALS.forEach((arrival, index) => {
    const calendarDate = addCalendarDays(context.today, -arrival.daysAgo);
    const assignment = addImport(context, {
      yardSlot: demoSlots[index],
      gateInAt: terminalDateTime(calendarDate, 14, 20),
      ownerCompanyId: companyByCode(context, arrival.companyCode).id,
      number: arrival.number ?? undefined,
    });
    flagContainer(context, assignment.container, 'DEMO');
    assignments.push(assignment);
  });
}

function placeStack(context, entries) {
  const { stack } = entries[0].yardSlot;
  const block = blockByCode(context, stack.blockCode);
  entries
    .sort((first, second) => first.container.gateInAt - second.container.gateInAt)
    .forEach(({ container, arrival }, index) => {
      const tier = index + 1;
      context.insert('containerPositions', {
        containerId: container.id,
        blockId: block.id,
        row: stack.row,
        bay: stack.bay,
        tier,
      });
      const positionCode = formatPositionCode({
        blockCode: block.code,
        row: stack.row,
        bay: stack.bay,
        tier,
      });
      context.containerInfo.get(container.id).positionCode = positionCode;
      addMovement(context, { container, toPosition: positionCode, ...arrival });
    });
}

function placeAssignments(context, assignments) {
  const entriesByStack = new Map();
  for (const assignment of assignments) {
    const key = stackKey(assignment.yardSlot.stack);
    entriesByStack.set(key, [...(entriesByStack.get(key) ?? []), assignment]);
  }
  for (const entries of entriesByStack.values()) {
    placeStack(context, entries);
  }
}

export function addYard(context) {
  const stacks = buildYardLayout(context.random, BLOCKS, {
    targetOccupancy: TARGET_OCCUPANCY,
    reservedStack: { ...DEMO_STACK, height: DEMO_STACK_ARRIVALS.length },
  });
  const slots = listSlots(stacks);
  const demoSlots = slots.filter((slot) => slot.stack.reserved);
  const yardPool = context.random.shuffle(slots.filter((slot) => !slot.stack.reserved));
  const events = planGateEvents(context);
  const assignments = [];

  const loadedToday = addGateIns(
    context,
    events.filter((event) => event.direction === 'IN'),
    yardPool,
    assignments,
  );
  for (const event of events.filter((candidate) => candidate.direction === 'OUT')) {
    addImportGateOut(context, event);
  }
  const dischargedToday = addYardImports(context, yardPool, assignments);
  addDemoStack(context, demoSlots, assignments);
  placeAssignments(context, assignments);
  return { stacks, loadedToday, dischargedToday };
}
