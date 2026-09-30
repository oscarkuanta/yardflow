import { DAY_MS } from '../../src/lib/terminal-time.js';
import { randomProfile } from './container-factory.js';
import { VESSEL_VISITS } from './reference-data.js';
import {
  addContainer,
  addMovement,
  flagContainer,
  hasFlag,
  hoursBefore,
  randomOwnerId,
  randomTimeBetween,
  roleOf,
  userByRole,
} from './seed-context.js';
import { timeFromToday, todaysVesselWorkWindow } from './build-yard.js';

const PLANNING_LEAD_DAYS = 7;

function addVisitItem(context, { visit, container, direction, doneAt = null }) {
  return context.insert('vesselVisitItems', {
    visitId: visit.id,
    containerNumber: container.number,
    containerId: container.id,
    direction,
    size: container.size,
    isHighCube: container.isHighCube,
    loadStatus: container.loadStatus,
    isDangerous: container.isDangerous,
    imoClass: container.imoClass,
    grossWeightKg: container.grossWeightKg,
    ownerCompanyId: container.ownerCompanyId,
    status: doneAt ? 'DONE' : 'PENDING',
    doneAt,
  });
}

function addExpectedImport(context) {
  return addContainer(context, {
    profile: randomProfile(context.random),
    ownerCompanyId: randomOwnerId(context),
    state: 'EXPECTED',
    role: 'IMPORT',
    createdAt: hoursBefore(context.now, context.random.integer(24, 96)),
  });
}

function completeLoad(context, container) {
  const workWindow = todaysVesselWorkWindow(context);
  const earliest = container.gateInAt > workWindow.start ? container.gateInAt : workWindow.start;
  container.departedAt = randomTimeBetween(context, earliest, workWindow.end);
  addMovement(context, {
    container,
    type: 'LOAD',
    fromPosition: context.containerInfo.get(container.id).positionCode,
    userId: userByRole(context, 'PLANNER').id,
    at: container.departedAt,
  });
  return container.departedAt;
}

function loadListCandidates(context) {
  return context.random.shuffle(
    context.tables.containers.filter(
      (container) =>
        container.state === 'IN_YARD' &&
        roleOf(context, container) === 'EXPORT' &&
        !hasFlag(context, container, 'DEMO'),
    ),
  );
}

function addVisit(context, definition) {
  return context.insert('vesselVisits', {
    vesselName: definition.vesselName,
    imoNumber: definition.imoNumber,
    voyage: definition.voyage,
    eta: timeFromToday(context, definition.eta),
    etd: timeFromToday(context, definition.etd),
    ata: definition.ata ? timeFromToday(context, definition.ata) : null,
    atd: null,
    status: definition.status,
    createdAt: new Date(context.now.getTime() - PLANNING_LEAD_DAYS * DAY_MS),
  });
}

function addDischargeList(context, visit, definition, dischargedToday) {
  const doneContainers = dischargedToday.slice(0, definition.discharge.done);
  for (const container of doneContainers) {
    addVisitItem(context, { visit, container, direction: 'DISCHARGE', doneAt: container.gateInAt });
  }
  for (let index = doneContainers.length; index < definition.discharge.total; index += 1) {
    addVisitItem(context, { visit, container: addExpectedImport(context), direction: 'DISCHARGE' });
  }
}

function addLoadList(context, visit, definition, loadedToday, candidates) {
  const doneContainers = loadedToday.slice(0, definition.load.done);
  for (const container of doneContainers) {
    const doneAt = completeLoad(context, container);
    addVisitItem(context, { visit, container, direction: 'LOAD', doneAt });
  }
  for (let index = doneContainers.length; index < definition.load.total; index += 1) {
    const container = candidates.pop();
    flagContainer(context, container, 'LOAD_LIST');
    addVisitItem(context, { visit, container, direction: 'LOAD' });
  }
}

export function addVesselVisits(context, { dischargedToday, loadedToday }) {
  const candidates = loadListCandidates(context);
  VESSEL_VISITS.forEach((definition, index) => {
    const visit = addVisit(context, definition);
    const isFirstVisit = index === 0;
    addDischargeList(context, visit, definition, isFirstVisit ? dischargedToday : []);
    addLoadList(context, visit, definition, isFirstVisit ? loadedToday : [], candidates);
  });
}
