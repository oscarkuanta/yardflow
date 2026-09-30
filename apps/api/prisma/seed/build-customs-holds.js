import { CUSTOMS_HOLD_REASONS } from './reference-data.js';
import {
  companyByCode,
  flagContainer,
  hasFlag,
  hoursAfter,
  hoursBefore,
  laterOf,
  randomTimeBetween,
  roleOf,
  userByRole,
} from './seed-context.js';

const ACTIVE_HOLD_COMPANIES = ['HNF', 'HNF', 'NRT', 'BLX'];
const RELEASED_HOLD_COUNT = 3;

function holdCandidates(context) {
  return context.random.shuffle(
    context.tables.containers.filter(
      (container) =>
        container.state === 'IN_YARD' &&
        roleOf(context, container) === 'IMPORT' &&
        container.gateInAt < hoursBefore(context.now, 48) &&
        !hasFlag(context, container, 'DEMO'),
    ),
  );
}

function takeCandidate(candidates, predicate) {
  const index = candidates.findIndex(predicate);
  if (index === -1) {
    throw new Error('No container left for a customs hold');
  }
  return candidates.splice(index, 1)[0];
}

function addHold(context, { container, placedAt, releasedAt = null }) {
  const admin = userByRole(context, 'ADMIN');
  flagContainer(context, container, releasedAt ? 'RELEASED_HOLD' : 'HOLD');
  return context.insert('customsHolds', {
    containerId: container.id,
    reason: context.random.pick(CUSTOMS_HOLD_REASONS),
    placedById: admin.id,
    placedAt,
    releasedById: releasedAt ? admin.id : null,
    releasedAt,
  });
}

function addActiveHolds(context, candidates) {
  for (const companyCode of ACTIVE_HOLD_COMPANIES) {
    const companyId = companyByCode(context, companyCode).id;
    const container = takeCandidate(candidates, (item) => item.ownerCompanyId === companyId);
    const earliest = laterOf(hoursAfter(container.gateInAt, 1), hoursBefore(context.now, 72));
    addHold(context, {
      container,
      placedAt: randomTimeBetween(context, earliest, hoursBefore(context.now, 1)),
    });
  }
  const expectedContainer = context.random.pick(
    context.tables.containers.filter((container) => container.state === 'EXPECTED'),
  );
  addHold(context, {
    container: expectedContainer,
    placedAt: randomTimeBetween(context, hoursBefore(context.now, 20), hoursBefore(context.now, 1)),
  });
}

function addReleasedHolds(context, candidates) {
  for (let index = 0; index < RELEASED_HOLD_COUNT; index += 1) {
    const container = takeCandidate(candidates, () => true);
    const placedAt = randomTimeBetween(
      context,
      hoursAfter(container.gateInAt, 1),
      hoursBefore(context.now, 30),
    );
    const releasedAt = randomTimeBetween(
      context,
      hoursAfter(placedAt, 3),
      hoursAfter(placedAt, 26),
    );
    addHold(context, { container, placedAt, releasedAt });
  }
}

export function addCustomsHolds(context) {
  const candidates = holdCandidates(context);
  addActiveHolds(context, candidates);
  addReleasedHolds(context, candidates);
}
